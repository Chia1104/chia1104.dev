import { describe, expect, it } from "vitest";

import {
  attachedContext,
  contextKeyOf,
  createAgentContextStore,
} from "../src/context.tsx";

const draft = { type: "draft", id: 7, label: "Untitled" };

describe("agent context store", () => {
  it("attaches every provided item until the operator detaches it", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().provide({ type: "feed", id: 3, label: "Post" });
    expect(attachedContext(store.getState())).toEqual([
      { type: "draft", id: 7 },
      { type: "feed", id: 3 },
    ]);

    store.getState().setAttached(contextKeyOf(draft), false);
    expect(attachedContext(store.getState())).toEqual([
      { type: "feed", id: 3 },
    ]);
    expect(store.getState().items).toHaveLength(2);

    store.getState().setAttached(contextKeyOf(draft), true);
    expect(attachedContext(store.getState())).toHaveLength(2);
  });

  it("keeps a detached item detached when only its label changes", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().setAttached(contextKeyOf(draft), false);
    store.getState().provide({ ...draft, label: "Now titled" });
    expect(store.getState().items).toEqual([{ ...draft, label: "Now titled" }]);
    expect(attachedContext(store.getState())).toEqual([]);
  });

  it("forgets the detach decision once the item is withdrawn", () => {
    const store = createAgentContextStore();
    store.getState().provide(draft);
    store.getState().setAttached(contextKeyOf(draft), false);
    store.getState().withdraw(contextKeyOf(draft));
    expect(store.getState().items).toEqual([]);

    store.getState().provide(draft);
    expect(attachedContext(store.getState())).toEqual([
      { type: "draft", id: 7 },
    ]);
  });
});
