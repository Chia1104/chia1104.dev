import { describe, expect, it } from "vitest";

import {
  composerDraftReducer,
  initialComposerDraft,
} from "../src/composer-draft.ts";
import type { ComposerDraft } from "../src/composer-draft.ts";

const interacting: ComposerDraft = {
  text: "/mo",
  cursor: 3,
  highlightedId: "local:model",
  activeDescendantId: "react-aria-1",
  dismissedSlashKey: "/mo 0 mo",
};

describe("composerDraftReducer", () => {
  it("replace drops every menu state keyed to the previous text", () => {
    expect(
      composerDraftReducer(interacting, {
        type: "replace",
        text: "/mod",
        cursor: 4,
      })
    ).toEqual({ text: "/mod", cursor: 4 });
  });

  it("moveCursor resets the highlight but keeps the dismissal", () => {
    expect(
      composerDraftReducer(interacting, { type: "moveCursor", cursor: 1 })
    ).toEqual({ ...interacting, cursor: 1, highlightedId: undefined });
  });

  it("reportActiveDescendant is a no-op when the id is unchanged", () => {
    expect(
      composerDraftReducer(interacting, {
        type: "reportActiveDescendant",
        id: "react-aria-1",
      })
    ).toBe(interacting);
  });

  it("dismissMenu records the slash key the operator escaped", () => {
    expect(
      composerDraftReducer(initialComposerDraft, {
        type: "dismissMenu",
        key: "k",
      })
    ).toEqual({ text: "", cursor: 0, dismissedSlashKey: "k" });
  });
});
