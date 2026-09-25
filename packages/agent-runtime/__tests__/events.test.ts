import { describe, expect, it } from "vitest";
import * as z from "zod";

import type { AssistantMessage, StopReason } from "../src/messages.ts";
import type { MessageEntry, SessionEntry } from "../src/session/entries.ts";
import { AgentErrorKind } from "../src/types.ts";
import { DETAILS_MAX_STRING_CHARS } from "../src/wire/clip.ts";
import { foldEvents } from "../src/wire/fold.ts";
import type { AgentViewItem } from "../src/wire/fold.ts";
import { entriesToWireEvents } from "../src/wire/replay.ts";
import type { AgentWireEvent } from "../src/wire/schema.ts";

import {
  assistantMessage,
  build,
  policy,
  toolCall,
} from "./runtime.fixture.ts";

/**
 * The fold is shared by the live stream and the replayed transcript, so any divergence shows up
 * as a UI that renders differently after a refresh.
 */

const presentation = {
  toolInfo: (name: string) => ({ label: name, tier: "read" }),
  summarize: () => "",
};

const messageEntry = (
  id: string,
  parentId: string | null,
  message: MessageEntry["message"],
  seq = 1
): MessageEntry => ({
  type: "message",
  id,
  parentId,
  seq,
  timestamp: message.timestamp,
  message,
});

const withCall = (stopReason: StopReason): AssistantMessage => ({
  ...assistantMessage("", 1),
  content: [
    { type: "toolCall", id: "call-1", name: "get_post", arguments: {} },
  ],
  stopReason,
});

describe("foldEvents", () => {
  it("carries an arbitrary tier through, not just the writing agent's three", () => {
    const state = foldEvents([
      {
        type: "tool:start",
        toolCallId: "c1",
        toolName: "send_email",
        label: "Send email",
        // A tier this package has never heard of. `ToolTier` is a string so a second agent kind
        // does not have to widen a union here.
        tier: "send",
        args: {},
      },
    ]);

    const tool = state.items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ tier: "send", status: "running" });
  });

  it("bumps stateRevision on a generic state:changed, whatever the scope", () => {
    const state = foldEvents([
      { type: "state:changed", scope: "draft", revision: 1 },
      { type: "state:changed", scope: "draft", revision: 2 },
    ]);
    expect(state.stateRevision).toBe(2);
  });

  it("reaches the same text with or without deltas", () => {
    const withDeltas: AgentWireEvent[] = [
      { type: "assistant:start", messageId: "a1" },
      {
        type: "assistant:delta",
        messageId: "a1",
        channel: "text",
        delta: "Hel",
      },
      {
        type: "assistant:delta",
        messageId: "a1",
        channel: "text",
        delta: "lo",
      },
      { type: "assistant:end", messageId: "a1", text: "Hello" },
    ];

    const textOf = (events: AgentWireEvent[]) =>
      foldEvents(events)
        .items.filter((item) => item.kind === "assistant")
        .map((item) => ("text" in item ? item.text : ""))
        .join("");

    expect(textOf(withDeltas)).toBe("Hello");
    // Replay omits deltas entirely; the coarse stream alone must produce the same view.
    expect(textOf(withDeltas.filter((e) => e.type !== "assistant:delta"))).toBe(
      "Hello"
    );
  });
});

describe("entriesToWireEvents", () => {
  it("folds a live turn and its replay to the same transcript", async () => {
    const fixture = build([
      {
        thinking: { text: "Look it up.", signature: "sig-1" },
        ...toolCall("search", { q: "hono" }, "call-1"),
      },
      { text: "Found it." },
    ]);
    await fixture.run();

    // Epoch stamps are taken twice for the user message, live and persisted; they may differ.
    const itemsOf = (events: readonly AgentWireEvent[]) =>
      foldEvents(events).items.map(
        ({ at: _at, ...item }: AgentViewItem & { at?: number }) => item
      );
    const replayed = entriesToWireEvents(await fixture.branch(), policy);

    expect(itemsOf(replayed)).toEqual(itemsOf(fixture.events));
  });

  it("uses persisted entry ids when replaying assistant messages", () => {
    const entries: SessionEntry[] = [
      messageEntry("entry-1", null, assistantMessage("First", 1), 1),
      messageEntry("entry-2", "entry-1", assistantMessage("Second", 2), 2),
    ];
    const all = entriesToWireEvents(entries, presentation).filter(
      (event) => event.type === "assistant:end"
    );
    const secondOnly = entriesToWireEvents(
      entries.slice(1),
      presentation
    ).filter((event) => event.type === "assistant:end");

    expect(all.map((event) => event.messageId)).toEqual(["entry-1", "entry-2"]);
    expect(secondOnly[0]?.messageId).toBe("entry-2");
  });

  it("replays the operator's words, not the attachment block the model read, beside the chips", () => {
    const attachments = [{ type: "draft" as const, id: 7, label: "My draft" }];
    const events = entriesToWireEvents(
      [
        {
          ...messageEntry("entry-1", null, {
            role: "user",
            content: [
              { type: "text", text: "<attachments>draft 7</attachments>" },
              { type: "text", text: "Tighten the intro." },
            ],
            timestamp: 5,
          }),
          attachments,
        },
      ],
      presentation
    );

    expect(events).toEqual([
      {
        type: "user",
        messageId: "entry-1",
        text: "Tighten the intro.",
        attachments,
        at: 5,
      },
    ]);
  });

  it("replays a user message without attachments as its whole text", () => {
    const [event] = entriesToWireEvents(
      [
        messageEntry("entry-1", null, {
          role: "user",
          content: [
            { type: "text", text: "Hello, " },
            { type: "text", text: "world." },
          ],
          timestamp: 5,
        }),
      ],
      presentation
    );

    expect(event).toMatchObject({ type: "user", text: "Hello, world." });
  });

  it("replays a compaction as its notice", () => {
    const events = entriesToWireEvents(
      [
        {
          type: "compaction",
          id: "entry-1",
          parentId: null,
          seq: 1,
          timestamp: 1,
          summary: "Everything so far.",
          tokensBefore: 90_000,
          retainedTail: [],
        },
      ],
      presentation
    );

    expect(events).toEqual([
      {
        type: "session:compacted",
        summary: "Everything so far.",
        tokensBefore: 90_000,
      },
    ]);
  });

  it("replays a branch summary as the rewind notice", () => {
    const entries: SessionEntry[] = [
      messageEntry("entry-1", null, assistantMessage("Kept", 1), 1),
      {
        type: "branch_summary",
        id: "entry-2",
        parentId: "entry-1",
        seq: 2,
        timestamp: 1_767_225_601_000,
        fromId: "entry-1",
        summary: "A tangent about titles, abandoned.",
      },
    ];

    const events = entriesToWireEvents(entries, presentation);

    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "session:rewound",
    ]);
    expect(foldEvents(events).items.at(-1)).toEqual({
      kind: "notice",
      variant: "rewound",
      text: "A tangent about titles, abandoned.",
    });
  });

  it("replays a failed reply as the same error notice the live turn emits", () => {
    const failed: AssistantMessage = {
      ...assistantMessage("", 1),
      stopReason: "error",
      errorMessage: "429 Too Many Requests",
    };

    const events = entriesToWireEvents(
      [messageEntry("entry-1", null, failed)],
      presentation
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "error",
    ]);
    expect(events[1]).toEqual({
      type: "error",
      kind: AgentErrorKind.RateLimited,
    });
    expect(foldEvents(events).items.at(-1)).toEqual({
      kind: "notice",
      variant: "error",
      code: AgentErrorKind.RateLimited,
    });
  });

  it("closes a call whose result never landed as aborted on replay", () => {
    const events = entriesToWireEvents(
      [
        messageEntry("a1", null, withCall("toolUse")),
        messageEntry(
          "u2",
          "a1",
          { role: "user", content: "again", timestamp: 2 },
          2
        ),
      ],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "tool:start",
      "tool:end",
      "user",
    ]);
    expect(events[2]).toMatchObject({
      toolCallId: "call-1",
      isError: false,
      aborted: true,
    });
    const tool = foldEvents(events).items.find((item) => item.kind === "tool");
    expect(tool).toMatchObject({ status: "aborted" });
  });

  it("summarises a failed call by the first line of its text, never by the kind", () => {
    const events = entriesToWireEvents(
      [
        messageEntry("a1", null, withCall("toolUse")),
        messageEntry(
          "t1",
          "a1",
          {
            role: "toolResult",
            toolCallId: "call-1",
            toolName: "get_post",
            content: [
              { type: "text", text: "No post has that slug.\nTry list_posts." },
            ],
            isError: true,
            timestamp: 2,
          },
          2
        ),
      ],
      { ...presentation, summarize: () => "kind summary" }
    );
    expect(events.at(-1)).toMatchObject({
      type: "tool:end",
      isError: true,
      summary: "No post has that slug.",
    });
  });

  it("closes a call cut off at the end of the branch, as a fork at the message leaves it", () => {
    const events = entriesToWireEvents(
      [messageEntry("a1", null, withCall("toolUse"))],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual([
      "assistant:end",
      "tool:start",
      "tool:end",
    ]);
  });

  it("shows no card for calls in a reply the stop cut short, as the live turn did not", () => {
    const events = entriesToWireEvents(
      [messageEntry("a1", null, withCall("aborted"))],
      presentation
    );
    expect(events.map((event) => event.type)).toEqual(["assistant:end"]);
  });

  it("clips oversized tool details on replay while keeping their shape", () => {
    const body = "x".repeat(DETAILS_MAX_STRING_CHARS + 100);
    const entries: SessionEntry[] = [
      messageEntry("entry-1", null, {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "get_post",
        content: [{ type: "text", text: "" }],
        details: { post: { slug: "hello", content: body } },
        isError: false,
        timestamp: 1,
      }),
    ];

    const [event] = entriesToWireEvents(entries, presentation);

    expect(event?.type).toBe("tool:end");
    const { details } = z
      .object({
        details: z.object({
          post: z.object({ slug: z.string(), content: z.string() }),
        }),
      })
      .parse(event);
    expect(details.post.slug).toBe("hello");
    expect(details.post.content.length).toBeLessThan(body.length);
    expect(details.post.content).toContain("[truncated 100 chars]");
  });
});
