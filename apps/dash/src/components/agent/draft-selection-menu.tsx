"use client";

import { useAgentContext } from "@chia/agent-elements/context";
import { SelectionMenu } from "@chia/agent-elements/selection";

import { agentDockStore } from "./dock-store";

export interface DraftSelection {
  text: string;
  startLine: number;
  endLine: number;
}

const PRESETS = [
  {
    id: "rewrite",
    label: "Rewrite this passage",
    prompt:
      "Rewrite the selected passage. Keep its meaning and the surrounding structure.",
  },
  {
    id: "tighten",
    label: "Tighten it",
    prompt:
      "Tighten the selected passage: shorter sentences, no filler, same meaning.",
  },
  {
    id: "translate",
    label: "Translate to the other locale",
    prompt:
      "Write the selected passage in the draft's other locale and put it in the corresponding place there. Leave this locale unchanged.",
  },
];

/** Opens the dock without disturbing a maximized one. */
const showDock = () => {
  const dock = agentDockStore.getState();
  if (dock.mode === "closed") dock.setMode("open");
};

/**
 * Presets and a free prompt for text selected in the editor. The draft is flushed before the
 * prompt goes out so the agent reads what the operator sees; the dock opens to show the turn.
 */
export const DraftSelectionMenu = ({
  draftId,
  flush,
  locale,
  onDone,
  selection,
}: {
  draftId: number;
  locale: string;
  selection: DraftSelection;
  /** Saves pending edits; `false` means the draft is blocked on a conflict. */
  flush: () => Promise<boolean>;
  onDone: () => void;
}) => {
  const request = useAgentContext((state) => state.request);
  const provide = useAgentContext((state) => state.provide);
  const source = {
    type: "draft" as const,
    id: draftId,
    locale,
    startLine: selection.startLine,
    endLine: selection.endLine,
  };
  const range =
    selection.startLine === selection.endLine
      ? `L${selection.startLine}`
      : `L${selection.startLine}–${selection.endLine}`;

  const send = async (prompt: string) => {
    onDone();
    if (!(await flush())) return;
    request({
      text: prompt,
      attachments: [{ type: "selection", text: selection.text, source }],
    });
    showDock();
  };

  const attach = () => {
    onDone();
    provide({
      type: "selection",
      text: selection.text,
      source,
      label: `Selection · ${locale} · ${range}`,
      once: true,
    });
    showDock();
  };

  return (
    <SelectionMenu
      actions={[
        ...PRESETS.map((preset) => ({
          id: preset.id,
          label: preset.label,
          onSelect: () => void send(preset.prompt),
        })),
        { id: "attach", label: "Attach to the next message", onSelect: attach },
      ]}
      preview={selection.text}
      prompt={{
        placeholder: "Ask about this passage…",
        submitLabel: "Send",
        onSubmit: (prompt) => void send(prompt),
      }}
    />
  );
};
