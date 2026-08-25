/**
 * The composer's local editing state. Text and cursor travel together so the slash-token lookup
 * never sees one updated without the other; the menu's highlight and dismissal are keyed to the
 * text they were made against and reset on any edit.
 */
export interface ComposerDraft {
  text: string;
  cursor: number;
  /** Menu item the operator moved to by keyboard or hover; `undefined` falls back to the first. */
  highlightedId?: string;
  /** DOM id of the highlighted option, reported back by the list for `aria-activedescendant`. */
  activeDescendantId?: string;
  /** Slash token the operator escaped out of; the menu stays closed until the token changes. */
  dismissedSlashKey?: string;
}

export type ComposerDraftAction =
  | { type: "replace"; text: string; cursor: number }
  | { type: "moveCursor"; cursor: number }
  | { type: "highlight"; id: string | undefined }
  | { type: "reportActiveDescendant"; id: string | undefined }
  | { type: "dismissMenu"; key: string };

/** A draft holding `text` with the caret at its end — what a seeded editor starts from. */
export const composerDraftOf = (text: string): ComposerDraft => ({
  text,
  cursor: text.length,
});

export const initialComposerDraft: ComposerDraft = composerDraftOf("");

export const composerDraftReducer = (
  draft: ComposerDraft,
  action: ComposerDraftAction
): ComposerDraft => {
  switch (action.type) {
    case "replace":
      return { text: action.text, cursor: action.cursor };
    case "moveCursor":
      return { ...draft, cursor: action.cursor, highlightedId: undefined };
    case "highlight":
      return { ...draft, highlightedId: action.id };
    case "reportActiveDescendant":
      return draft.activeDescendantId === action.id
        ? draft
        : { ...draft, activeDescendantId: action.id };
    case "dismissMenu":
      return { ...draft, dismissedSlashKey: action.key };
  }
};
