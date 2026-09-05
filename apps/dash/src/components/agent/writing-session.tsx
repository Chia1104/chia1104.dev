"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Composer } from "@chia/agent-elements/composer";
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
  "Review the current draft and tighten the writing.",
];

export const WritingSession = ({ tabs }: { tabs: ReactNode }) => {
  const drafts = useSessionDetail().data?.drafts ?? [];
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
      <header className="border-border flex min-w-0 items-center gap-3 border-b px-4 py-3">
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
          drafts.length > 0 ? <SessionDrafts drafts={drafts} /> : undefined
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
