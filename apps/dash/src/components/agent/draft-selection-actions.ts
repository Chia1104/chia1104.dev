"use client";

import { useAgentContext } from "@chia/agent-elements/context";

import type {
  EditorSelection,
  EditorSelectionAction,
} from "@/components/feed/markdown-editor";

import { agentDockStore } from "./dock-store";

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
 * The editor's context-menu entries for selected text: presets that send a turn, and one that
 * attaches the selection for the operator to ask about in the composer. The draft is flushed
 * before a prompt goes out so the agent reads what the operator sees; the dock opens to show it.
 */
export const useDraftSelectionActions = ({
  draftId,
  flush,
  locale,
}: {
  draftId: number;
  locale: string;
  /** Saves pending edits; `false` means the draft is blocked on a conflict. */
  flush: () => Promise<boolean>;
}): EditorSelectionAction[] => {
  const request = useAgentContext((state) => state.request);
  const provide = useAgentContext((state) => state.provide);

  const sourceOf = (selection: EditorSelection) => ({
    type: "draft" as const,
    id: draftId,
    locale,
    startLine: selection.startLine,
    endLine: selection.endLine,
  });

  const send = async (prompt: string, selection: EditorSelection) => {
    if (!(await flush())) return;
    request({
      text: prompt,
      attachments: [
        {
          type: "selection",
          text: selection.text,
          source: sourceOf(selection),
        },
      ],
    });
    showDock();
  };

  const attach = (selection: EditorSelection) => {
    const range =
      selection.startLine === selection.endLine
        ? `L${selection.startLine}`
        : `L${selection.startLine}–${selection.endLine}`;
    provide({
      type: "selection",
      text: selection.text,
      source: sourceOf(selection),
      label: `Selection · ${locale} · ${range}`,
      once: true,
    });
    showDock();
  };

  return [
    ...PRESETS.map((preset) => ({
      id: preset.id,
      label: preset.label,
      run: (selection: EditorSelection) => void send(preset.prompt, selection),
    })),
    { id: "attach", label: "Ask the agent about this", run: attach },
  ];
};
