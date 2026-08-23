"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import { Composer } from "@chia/agent-elements/composer";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { ModelPicker } from "@chia/agent-elements/model-picker";
import { useSessionDetail } from "@chia/agent-elements/provider";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { webToolRenderers } from "@chia/agent-elements/renderers/web";
import { Thread } from "@chia/agent-elements/thread";

import { DraftAttachments } from "./draft-attachments";

/**
 * Providers in the order offered: the gateway leads because it is the house account and needs no
 * setup; the bring-your-own-key providers follow.
 */
const PROVIDER_ORDER = ["vercel-ai-gateway", "openai", "anthropic"];

const TOOL_RENDERERS = { ...contentToolRenderers, ...webToolRenderers };

const SUGGESTIONS = [
  "Outline a post about what I've been building lately.",
  "Draft a new post from my most recent notes.",
  "Review the current draft and tighten the writing.",
];

/** The writing agent's session view: the shared chat elements with the draft riding on the composer. */
export const WritingSession = ({ tabs }: { tabs: ReactNode }) => {
  const draft = useSessionDetail().data?.draft;
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
      <header className="border-border flex items-center gap-3 border-b px-4 py-3">
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
        attachments={draft ? <DraftAttachments draft={draft} /> : undefined}
        localCommands={localCommands}
        placeholder="Ask the writing agent…"
        toolbar={
          <ModelPicker
            isOpen={modelPickerOpen}
            onOpenChange={setModelPickerOpen}
            providerOrder={PROVIDER_ORDER}
          />
        }
      />
    </>
  );
};
