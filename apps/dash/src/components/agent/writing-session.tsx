"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Composer, ComposerContext } from "@chia/agent-elements/composer";
import { contextKeyOf, useAgentContext } from "@chia/agent-elements/context";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { useSessionDetail } from "@chia/agent-elements/provider";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { memoryToolRenderers } from "@chia/agent-elements/renderers/memory";
import { webToolRenderers } from "@chia/agent-elements/renderers/web";
import { SessionModelPicker } from "@chia/agent-elements/session-model-picker";
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

export const WritingSession = ({ tabs }: { tabs: ReactNode }) => {
  const drafts = useSessionDetail().data?.drafts ?? [];
  // The page's own records are listed by the composer; the session's other drafts follow.
  const context = useAgentContext((state) => state.items);
  const onScreen = new Set(context.map(contextKeyOf));
  const otherDrafts = drafts.filter(
    (draft) => !onScreen.has(contextKeyOf({ type: "draft", id: draft.id }))
  );

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const localCommands = useMemo(
    () => [
      {
        name: "model",
        description: "Switch the response model for this conversation.",
        onSelect: () => setModelPickerOpen(true),
      },
    ],
    []
  );

  return (
    <>
      <header className="flex min-w-0 items-center gap-3 px-3.5 py-2.5 pt-0 sm:pt-2.5">
        {tabs}
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
        localCommands={localCommands}
        placeholder="Ask the writing agent…"
        toolbar={
          <SessionModelPicker
            isOpen={modelPickerOpen}
            onOpenChange={setModelPickerOpen}
            providerOrder={PROVIDER_ORDER}
          />
        }
      />
    </>
  );
};
