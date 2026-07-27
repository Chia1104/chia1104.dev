import { InMemorySessionRepo } from "@earendil-works/pi-agent-core";
import type { AgentHarness } from "@earendil-works/pi-agent-core";
import { createModels } from "@earendil-works/pi-ai";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai/providers/faux";
import { beforeEach, describe, expect, it } from "vitest";

import { foldEvents } from "@chia/agent-core";
import type { AgentWireEvent } from "@chia/agent-core";
import { InMemoryPendingMessageStore } from "@chia/agent-core";
import type { AgentSessionSettings } from "@chia/agent-core";

import { InMemoryDraftStore } from "../src/draft/index.ts";
import { createWritingHarness } from "../src/harness.ts";
import { TOOL_NAMES } from "../src/tools/registry.ts";
import type { WritingToolContext } from "../src/types.ts";

import { createFakeContentPort } from "./fixtures.ts";
import type { FakeContentPort } from "./fixtures.ts";

/**
 * End-to-end harness tests against pi-ai's `faux` provider.
 *
 * These exercise the real `AgentHarness`, the real tools and the real permission gate with
 * scripted assistant messages, so the tool loop, the tier-3 refusal handshake and the event
 * mapping are all covered offline — no network, no database.
 */

const SESSION_ID = "session-1";
const ADMIN_ID = "admin-1";

interface Fixture {
  harness: AgentHarness<WritingToolContext>;
  events: AgentWireEvent[];
  content: FakeContentPort;
  draft: InMemoryDraftStore;
  setResponses: (
    responses: Parameters<ReturnType<typeof fauxProvider>["setResponses"]>[0]
  ) => void;
  dispose: () => void;
  approvalRequests: () => readonly { toolName: string }[];
}

const build = async (
  settings: Partial<AgentSessionSettings> = {}
): Promise<Fixture> => {
  const faux = fauxProvider({
    provider: "vercel-ai-gateway",
    models: [{ id: "anthropic/claude-sonnet-5" }],
  });
  const models = createModels();
  models.setProvider(faux.provider);

  const session = await new InMemorySessionRepo().create({ id: SESSION_ID });
  const content = createFakeContentPort({
    searchHits: [
      {
        slug: "existing-post",
        locale: "en",
        title: "An existing post",
        snippet: "…",
      },
    ],
    tags: [{ slug: "typescript", names: { en: "TypeScript" } }],
  });
  const draft = new InMemoryDraftStore();
  const events: AgentWireEvent[] = [];

  const built = await createWritingHarness({
    session,
    settings: {
      providerId: "vercel-ai-gateway",
      modelId: "anthropic/claude-sonnet-5",
      thinkingLevel: "off",
      activeToolNames: null,
      autoApprove: [],
      ...settings,
    },
    agentSessionId: SESSION_ID,
    adminId: ADMIN_ID,
    content,
    draft,
    pending: new InMemoryPendingMessageStore(),
    onEvent: (event) => events.push(event),
    models,
  });

  return {
    harness: built.harness,
    events,
    content,
    draft,
    setResponses: faux.setResponses,
    dispose: built.dispose,
    approvalRequests: () => built.approvalRequests,
  };
};

describe("createWritingHarness", () => {
  let fixture: Fixture;

  beforeEach(async () => {
    fixture = await build();
  });

  it("runs a tool then reports back, and maps both into wire events", async () => {
    fixture.setResponses([
      fauxAssistantMessage(
        [fauxToolCall(TOOL_NAMES.searchPosts, { keyword: "typescript" })],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("There is already a post about TypeScript."),
    ]);

    await fixture.harness.prompt("Is there a post about TypeScript?");

    const toolStart = fixture.events.find((e) => e.type === "tool:start");
    const toolEnd = fixture.events.find((e) => e.type === "tool:end");

    expect(toolStart).toMatchObject({
      toolName: TOOL_NAMES.searchPosts,
      tier: "read",
    });
    expect(toolEnd).toMatchObject({
      toolName: TOOL_NAMES.searchPosts,
      isError: false,
      summary: "1 match(es).",
    });

    const view = foldEvents(fixture.events);
    const assistant = view.items.filter((item) => item.kind === "assistant");
    expect(assistant.at(-1)).toMatchObject({
      text: "There is already a post about TypeScript.",
      streaming: false,
    });
  });

  it("writes the draft buffer and never touches published content", async () => {
    fixture.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.writeDraftContent, {
            locale: "en",
            content: "## Hello\n\nSome body text.",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("Draft written."),
    ]);

    await fixture.harness.prompt("Draft something");

    const draft = await fixture.draft.get(SESSION_ID);
    expect(draft.translations.en?.content).toBe("## Hello\n\nSome body text.");
    expect(fixture.content.commits).toHaveLength(0);

    // A draft mutation must announce itself so the client refetches. The event is generic
    // (`state:changed`) with the writing policy's scope attached.
    expect(fixture.events.some((e) => e.type === "state:changed")).toBe(true);
  });

  it("blocks a commit without approval and tells the model to stop", async () => {
    fixture.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.writeDraftContent, {
            locale: "en",
            content: "## Post\n\nBody.",
          }),
          fauxToolCall(TOOL_NAMES.patchDraftMeta, {
            locale: "en",
            title: "A post",
            slug: "a-post",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.commitDraft, {
            confirmation: "Committing the English post.",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("Waiting for your approval."),
    ]);

    await fixture.harness.prompt("Write and commit a post");

    expect(fixture.content.commits).toHaveLength(0);
    expect(fixture.approvalRequests().map((r) => r.toolName)).toEqual([
      TOOL_NAMES.commitDraft,
    ]);

    const request = fixture.events.find((e) => e.type === "approval:request");
    expect(request).toMatchObject({
      toolName: TOOL_NAMES.commitDraft,
      tier: "commit",
    });

    const view = foldEvents(fixture.events);
    expect(view.pendingApprovals.map((p) => p.toolName)).toEqual([
      TOOL_NAMES.commitDraft,
    ]);
  });

  it("lets a commit through once the tier is pre-approved", async () => {
    const approved = await build({ autoApprove: ["commit"] });
    approved.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.writeDraftContent, {
            locale: "en",
            content: "## Post\n\nBody.",
          }),
          fauxToolCall(TOOL_NAMES.patchDraftMeta, {
            locale: "en",
            title: "A post",
            slug: "a-post",
            defaultLocale: "en",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.commitDraft, {
            confirmation: "Committing the English post.",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("Committed."),
    ]);

    await approved.harness.prompt("Write and commit a post");

    expect(approved.content.commits).toHaveLength(1);
    expect(approved.content.commits[0]).toMatchObject({
      adminId: ADMIN_ID,
      feedMeta: { slug: "a-post", defaultLocale: "en" },
    });
    expect(approved.events.some((e) => e.type === "approval:request")).toBe(
      false
    );
    approved.dispose();
  });

  it("refuses to commit a draft whose default locale has no title", async () => {
    const approved = await build({ autoApprove: ["commit"] });
    approved.setResponses([
      fauxAssistantMessage(
        [
          fauxToolCall(TOOL_NAMES.writeDraftContent, {
            locale: "en",
            content: "## Post\n\nBody.",
          }),
          fauxToolCall(TOOL_NAMES.commitDraft, {
            confirmation: "Committing.",
          }),
        ],
        { stopReason: "toolUse" }
      ),
      fauxAssistantMessage("I need a title first."),
    ]);

    await approved.harness.prompt("Commit it");

    expect(approved.content.commits).toHaveLength(0);
    const commitEvent = approved.events.find(
      (e) => e.type === "tool:end" && e.toolName === TOOL_NAMES.commitDraft
    );
    expect(commitEvent).toMatchObject({ isError: true });
    approved.dispose();
  });

  it("streams text deltas that fold into the finished message", async () => {
    fixture.setResponses([
      fauxAssistantMessage([fauxText("Hello there, operator.")]),
    ]);

    await fixture.harness.prompt("Hi");

    const deltas = fixture.events.filter((e) => e.type === "assistant:delta");
    expect(deltas.length).toBeGreaterThan(0);

    // The fold must reach the same text whether or not the deltas were seen.
    const withDeltas = foldEvents(fixture.events);
    const withoutDeltas = foldEvents(
      fixture.events.filter((e) => e.type !== "assistant:delta")
    );
    const textOf = (state: ReturnType<typeof foldEvents>) =>
      state.items
        .filter((item) => item.kind === "assistant")
        .map((item) => ("text" in item ? item.text : ""))
        .join("");

    expect(textOf(withDeltas)).toBe("Hello there, operator.");
    expect(textOf(withoutDeltas)).toBe("Hello there, operator.");
  });
});
