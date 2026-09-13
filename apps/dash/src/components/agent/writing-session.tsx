"use client";

import type { ReactNode } from "react";

import { attachmentKeyOf } from "@chia/agent-elements/attachment";
import { Composer, ComposerContext } from "@chia/agent-elements/composer";
import { useAgentContext } from "@chia/agent-elements/context";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { useSessionDetail } from "@chia/agent-elements/provider";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { memoryToolRenderers } from "@chia/agent-elements/renderers/memory";
import { webToolRenderers } from "@chia/agent-elements/renderers/web";
import { Thread } from "@chia/agent-elements/thread";

import { SessionDrafts } from "./session-drafts";

/** Gateway first: house account, no setup. BYOK providers follow. */
const PROVIDER_ORDER = ["vercel-ai-gateway", "openai", "anthropic"];

const TOOL_RENDERERS = {
  ...contentToolRenderers,
  ...webToolRenderers,
  ...memoryToolRenderers,
};

const SUGGESTIONS = [
  "Outline a post about what I've been building lately.",
  "Draft a new post from my most recent notes.",
  "Review the draft I have open and tighten the writing.",
];

export const WritingSession = ({
  tabs,
  actions,
}: {
  tabs: ReactNode;
  /** The host's controls for the panel itself, after the tabs. */
  actions?: ReactNode;
}) => {
  const drafts = useSessionDetail().data?.drafts ?? [];
  // The page's own records are listed by the composer; the session's other drafts follow.
  const context = useAgentContext((state) => state.items);
  const onScreen = new Set(context.map(attachmentKeyOf));
  const otherDrafts = drafts.filter(
    (draft) => !onScreen.has(attachmentKeyOf({ type: "draft", id: draft.id }))
  );

  return (
    <>
      <header className="flex h-12 min-w-0 shrink-0 items-center gap-3 px-3.5">
        {tabs}
        {actions}
      </header>

      <Thread
        renderers={TOOL_RENDERERS}
        empty={
          <EmptyState
            description="I can search and read the blog, draft posts per locale, and only publish once you approve."
            suggestions={SUGGESTIONS}
            title="What are we writing?"
          />
        }
      />
      <Composer
        attachments={
          context.length > 0 || otherDrafts.length > 0 ? (
            <>
              <ComposerContext />
              <SessionDrafts drafts={otherDrafts} />
            </>
          ) : undefined
        }
        placeholder="Ask the writing agent…"
        providerOrder={PROVIDER_ORDER}
      />
    </>
  );
};
