import { createModels } from "@earendil-works/pi-ai";
import type { Context } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { beforeEach, describe, expect, it } from "vitest";

import type {
  ContentReadPort,
  ProfileEntrySnapshot,
} from "@chia/agent-content/types";
import { UnknownAgentModelError } from "@chia/agent-runtime/models";
import type { ApprovalRequest } from "@chia/agent-runtime/pi/tool-gate";
import { InMemorySessionTree } from "@chia/agent-runtime/session/tree";
import type { SessionTree } from "@chia/agent-runtime/session/tree";
import type {
  AgentSessionSettings,
  AgentTurnExecution,
} from "@chia/agent-runtime/types";
import { foldEvents } from "@chia/agent-runtime/wire/fold";
import type {
  AgentAttachmentInput,
  AgentWireEvent,
} from "@chia/agent-runtime/wire/schema";
import { createFakeContentReadPort } from "@chia/test/fixtures/content-read-port";
import { createFakeProfileReadPort } from "@chia/test/fixtures/profile-read-port";

import { DEFAULT_PUBLIC_MODEL } from "../src/models.ts";
import { publicTurnBudget } from "../src/policy.ts";
import { runPublicTurn } from "../src/runtime.ts";
import { TOOL_NAMES } from "../src/tools/registry.ts";

const SESSION_ID = "session-1";

const PROFILE: ProfileEntrySnapshot[] = [
  {
    kind: "about",
    data: { translations: { en: { title: "Frontend engineer" } } },
  },
];

interface Fixture {
  events: AgentWireEvent[];
  session: SessionTree;
  setResponses: (
    responses: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0]
  ) => void;
  run: (
    text: string,
    attachments?: AgentAttachmentInput[]
  ) => Promise<AgentTurnExecution<ApprovalRequest>>;
}

const build = (settings: Partial<AgentSessionSettings> = {}): Fixture => {
  const providerId = settings.providerId ?? DEFAULT_PUBLIC_MODEL.providerId;
  const modelId = settings.modelId ?? DEFAULT_PUBLIC_MODEL.modelId;
  const faux = fauxProvider({
    provider: providerId,
    models: [{ id: modelId }],
  });
  const models = createModels();
  models.setProvider(faux.provider);

  const session = new InMemorySessionTree(SESSION_ID);
  const content =
    /* SAFETY: This fixture implements the ContentReadPort methods these tests exercise. */ createFakeContentReadPort(
      {
        searchHits: [
          {
            slug: "existing-post",
            locale: "en",
            url: "http://localhost:3000/en-US/posts/existing-post",
            title: "An existing post",
            snippet: "…",
          },
        ],
        posts: [
          {
            feedId: 1,
            slug: "existing-post",
            url: "http://localhost:3000/en-US/posts/existing-post",
            type: "post",
            contentType: "mdx",
            published: true,
            defaultLocale: "en",
            translations: [
              {
                locale: "en",
                url: "http://localhost:3000/en-US/posts/existing-post",
                title: "An existing post",
                content: "## Existing section\n\nExisting body.",
              },
            ],
            tagSlugs: ["typescript"],
          },
        ],
        tags: [{ slug: "typescript", names: { en: "TypeScript" } }],
      }
    ) as ContentReadPort;
  const events: AgentWireEvent[] = [];
  const sessionSettings: AgentSessionSettings = {
    providerId,
    modelId,
    thinkingLevel: "off",
    activeToolNames: null,
    autoApprove: [],
    ...settings,
  };

  return {
    events,
    session,
    setResponses: faux.setResponses,
    run: (text, attachments) =>
      runPublicTurn({
        session,
        settings: sessionSettings,
        agentSessionId: SESSION_ID,
        content,
        profile: createFakeProfileReadPort(PROFILE),
        message: { text, attachments },
        onEvent: (event) => events.push(event),
        models,
        toApproval: (approval) => approval,
        persistApproval: async () => undefined,
      }),
  };
};

describe("runPublicTurn", () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = build();
  });

  it("searches, reads and answers, with every tool call marked read", async () => {
    fixture.setResponses([
      fauxAssistantMessage(
        [fauxToolCall(TOOL_NAMES.searchPosts, { keyword: "typescript" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [fauxToolCall(TOOL_NAMES.getPost, { slug: "existing-post" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("See `existing-post`."),
    ]);

    const result = await fixture.run("Is there a post about TypeScript?");

    expect(result.status).toBe("done");
    expect(result.approval).toBeUndefined();
    const ends = fixture.events.filter((event) => event.type === "tool:end");
    expect(ends).toMatchObject([
      {
        toolName: TOOL_NAMES.searchPosts,
        isError: false,
        summary: "1 match(es).",
      },
      {
        toolName: TOOL_NAMES.getPost,
        isError: false,
        summary: "Read `existing-post`.",
      },
    ]);
    expect(
      fixture.events
        .filter((event) => event.type === "tool:start")
        .every((event) => event.type === "tool:start" && event.tier === "read")
    ).toBe(true);
    expect(
      fixture.events.some((event) => event.type === "approval:request")
    ).toBe(false);

    const assistant = foldEvents(fixture.events).items.filter(
      (item) => item.kind === "assistant"
    );
    expect(assistant.at(-1)).toMatchObject({
      text: "See `existing-post`.",
      streaming: false,
    });
  });

  it("sends the clock as a volatile last message and keeps the system prompt stable", async () => {
    const seen: Context[] = [];
    fixture.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage([fauxToolCall(TOOL_NAMES.listTags, {})]);
      },
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("Done.");
      },
    ]);

    await fixture.run("What does the blog cover?");

    expect(seen).toHaveLength(2);
    for (const context of seen) {
      expect(context.systemPrompt).not.toContain("# Current session");
      expect(context.systemPrompt).toContain(
        "# About the author\n\n### Frontend engineer"
      );
      const last = context.messages.at(-1);
      expect(last?.role).toBe("user");
      expect(JSON.stringify(last?.content)).toMatch(
        /Current time: \d{4}-\d{2}-\d{2}T/
      );
    }
    expect(seen[0]?.systemPrompt).toBe(seen[1]?.systemPrompt);
    expect(JSON.stringify(await fixture.session.getBranch())).not.toContain(
      "# Current session"
    );
  });

  it("quotes a selection from a published post with its heading, and skips one it cannot read", async () => {
    const seen: Context[] = [];
    fixture.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("It means this.");
      },
    ]);

    await fixture.run("What does this mean?", [
      {
        type: "selection",
        text: "Existing body.",
        source: {
          type: "feed",
          id: 1,
          locale: "en",
          headingPath: "Existing section",
        },
      },
      {
        type: "selection",
        text: "Hidden words",
        source: { type: "feed", id: 99, locale: "en" },
      },
    ]);

    const prompt = seen[0]?.messages.find((m) => m.role === "user");
    const blocks = JSON.stringify(prompt?.content);
    expect(blocks).toContain(
      'Selected in the post \\"An existing post\\" (slug `existing-post`, locale en, under \\"Existing section\\")'
    );
    expect(blocks).toContain("Existing body.");
    expect(blocks).toContain("a post this agent cannot read; ignore it");
    expect(blocks).toContain("What does this mean?");
    expect(fixture.events.find((e) => e.type === "user")).toMatchObject({
      attachments: [
        { type: "selection", label: "An existing post · Existing section" },
        { type: "selection", label: "Selection" },
      ],
    });
  });

  it("names the post the visitor is reading, and skips one it cannot read", async () => {
    const seen: Context[] = [];
    fixture.setResponses([
      (context) => {
        seen.push(context);
        return fauxAssistantMessage("It is about this.");
      },
    ]);

    await fixture.run("What is this about?", [
      { type: "feed", id: 1, locale: "en" },
      { type: "feed", id: 99, locale: "en" },
    ]);

    const prompt = seen[0]?.messages.find((m) => m.role === "user");
    const blocks = JSON.stringify(prompt?.content);
    expect(blocks).toContain(
      'The visitor is reading the post \\"An existing post\\" (slug `existing-post`, locale en) at http://localhost:3000/en-US/posts/existing-post'
    );
    expect(blocks).toContain("A post this agent cannot read; ignore it");
    expect(fixture.events.find((e) => e.type === "user")).toMatchObject({
      attachments: [
        { type: "feed", label: "An existing post" },
        { type: "feed", label: "Post #99" },
      ],
    });
  });

  it("refuses calls past the soft budget and still ends the turn", async () => {
    const calls = publicTurnBudget.maxToolCalls + 1;
    fixture.setResponses([
      ...Array.from({ length: calls }, (_, index) =>
        fauxAssistantMessage(
          [fauxToolCall(TOOL_NAMES.searchPosts, { keyword: `query ${index}` })],
          { stopReason: "toolUse" }
        )
      ),
      fauxAssistantMessage("Here is what I found."),
    ]);

    const result = await fixture.run("Search for everything");

    expect(result.status).toBe("done");
    const ends = fixture.events.filter((event) => event.type === "tool:end");
    expect(ends).toHaveLength(calls);
    expect(
      ends
        .slice(0, -1)
        .every((event) => event.type === "tool:end" && !event.isError)
    ).toBe(true);
    expect(ends.at(-1)).toMatchObject({ isError: true });
  });

  it("runs on a native provider when the settings name one", async () => {
    const native = build({ providerId: "openai", modelId: "gpt-5.2" });
    native.setResponses([fauxAssistantMessage("Answered over OpenAI.")]);

    await native.run("Who is answering?");

    expect(
      foldEvents(native.events)
        .items.filter((item) => item.kind === "assistant")
        .at(-1)
    ).toMatchObject({ text: "Answered over OpenAI.", streaming: false });
  });

  it("refuses a gateway model off the house list before touching the provider", async () => {
    const expensive = build({ modelId: "anthropic/claude-sonnet-5" });

    await expect(expensive.run("Hi")).rejects.toThrow(UnknownAgentModelError);
    expect(expensive.events).toEqual([]);
  });
});
