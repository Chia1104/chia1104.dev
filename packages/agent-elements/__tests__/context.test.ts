import { describe, expect, it } from "vitest";

import { attachmentKeyOf } from "../src/attachment.ts";
import { attachedContext, createAgentContextStore } from "../src/context.tsx";
import type { AgentContextItem } from "../src/context.tsx";

const draft: AgentContextItem = { type: "draft", id: 7, label: "Untitled" };

const selection: AgentContextItem = {
  type: "selection",
  text: "Selected words",
  source: {
    type: "draft",
    id: 7,
    locale: "zh-TW",
    startLine: 3,
    endLine: 4,
  },
  label: "Untitled · L3–4",
  once: true,
};

describe("agent context store", () => {
  it("attaches every provided item until the operator detaches it", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().provide(selection);
    expect(attachedContext(store.getState())).toEqual([
      { type: "draft", id: 7 },
      { type: "selection", text: selection.text, source: selection.source },
    ]);

    store.getState().setAttached(attachmentKeyOf(draft), false);
    expect(attachedContext(store.getState())).toEqual([
      { type: "selection", text: selection.text, source: selection.source },
    ]);
    expect(store.getState().items).toHaveLength(2);

    store.getState().setAttached(attachmentKeyOf(draft), true);
    expect(attachedContext(store.getState())).toHaveLength(2);
  });

  it("keeps a detached item detached when only its label changes", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().setAttached(attachmentKeyOf(draft), false);
    store.getState().provide({ ...draft, label: "Now titled" });
    expect(store.getState().items).toEqual([{ ...draft, label: "Now titled" }]);
    expect(attachedContext(store.getState())).toEqual([]);
  });

  it("forgets the detach decision once the item is withdrawn", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().setAttached(attachmentKeyOf(draft), false);
    store.getState().withdraw(attachmentKeyOf(draft));
    expect(store.getState().items).toEqual([]);

    store.getState().provide(draft);
    expect(attachedContext(store.getState())).toEqual([
      { type: "draft", id: 7 },
    ]);
  });

  it("withdraws a one-off item once a prompt carried it, and keeps the standing ones", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().provide(selection);
    store.getState().sent();
    expect(store.getState().items).toEqual([draft]);

    // Detached at the time of sending means it was not carried; it stays for the next prompt.
    store.getState().provide(selection);
    store.getState().setAttached(attachmentKeyOf(selection), false);
    store.getState().sent();
    expect(store.getState().items).toEqual([draft, selection]);
  });

  it("holds one pending request until it is taken", () => {
    const store = createAgentContextStore();
    expect(store.getState().takeRequest()).toBeNull();

    const request = { text: "Explain this", attachments: [selection] };
    store.getState().request(request);
    store.getState().request({ text: "Explain this instead" });
    expect(store.getState().takeRequest()).toEqual({
      text: "Explain this instead",
    });
    expect(store.getState().pending).toBeNull();
    expect(store.getState().takeRequest()).toBeNull();
  });
});
