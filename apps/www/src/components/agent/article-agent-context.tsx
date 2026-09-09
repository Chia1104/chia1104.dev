"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

import { useTranslations } from "next-intl";

import {
  useAgentContext,
  useProvideAgentContext,
} from "@chia/agent-elements/context";
import {
  SelectionMenu,
  SelectionTrigger,
  useDomSelection,
} from "@chia/agent-elements/selection";
import type { DomSelection } from "@chia/agent-elements/selection";

import { useChatDockStore } from "@/stores/chat-dock/store";
import { useSettingsStore } from "@/stores/settings/store";

/** The trigger hangs this far below the selected text. */
const TRIGGER_GAP_PX = 6;

/**
 * Questions a reader can ask about a passage. Fixed rather than typed: a guest's weekly allowance
 * is small, and the passage plus a known question is all the model needs.
 */
const QUESTIONS = ["explain", "example", "related"] as const;

/** Opens the chat without disturbing a maximized one. */
const showChat = () => {
  const dock = useChatDockStore.getState();
  if (dock.mode === "closed") dock.setMode("open");
};

/**
 * What the reader has open, for the chat beside the post: the post itself rides along with
 * every prompt while the page is mounted, and a selected passage can be asked about from a
 * menu on the selection. The prompt is handed to the chat dock, which sends it once its
 * session is ready.
 */
export const ArticleAgentContext = ({
  children,
  feedId,
  locale,
  title,
}: {
  children: ReactNode;
  feedId: number;
  locale: string;
  title: string;
}) => {
  const t = useTranslations("chbot.selection");
  const aiEnabled = useSettingsStore((state) => state.aiEnabled);
  const ref = useRef<HTMLDivElement>(null);
  // The container also holds the table of contents; only the body's text is a passage.
  const selection = useDomSelection(ref, { within: ".prose" });
  const request = useAgentContext((state) => state.request);
  useProvideAgentContext(
    aiEnabled ? { type: "feed", id: feedId, locale, label: title } : null
  );

  const ask = (prompt: string, passage: DomSelection, close: () => void) => {
    close();
    request({
      text: prompt,
      attachments: [
        {
          type: "selection",
          text: passage.text,
          source: {
            type: "feed",
            id: feedId,
            locale,
            headingPath: passage.headingPath,
          },
        },
      ],
    });
    showChat();
  };

  return (
    <div ref={ref} className="contents">
      {children}
      {aiEnabled ? (
        <SelectionTrigger
          anchor={
            selection
              ? {
                  top: selection.rect.bottom + TRIGGER_GAP_PX,
                  left: selection.rect.right,
                }
              : null
          }
          label={t("ask")}
          selection={selection}>
          {(passage, close) => (
            <SelectionMenu
              actions={QUESTIONS.map((id) => ({
                id,
                label: t(id),
                onSelect: () => ask(t(`${id}Prompt`), passage, close),
              }))}
              preview={passage.text}
            />
          )}
        </SelectionTrigger>
      ) : null}
    </div>
  );
};
