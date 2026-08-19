"use client";

import type { ReactNode } from "react";

import { Tabs } from "@heroui/react";

import { StatusChip } from "@chia/agent-elements/chat";
import { Composer } from "@chia/agent-elements/composer";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { ModelPicker } from "@chia/agent-elements/model-picker";
import { useSessionDetail } from "@chia/agent-elements/provider";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { webToolRenderers } from "@chia/agent-elements/renderers/web";
import { Thread } from "@chia/agent-elements/thread";

import { AgentDraftPreview } from "./agent-draft-preview";

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

/** The writing agent's session view: the shared chat elements plus its draft preview. */
export const WritingSession = ({ tabs }: { tabs: ReactNode }) => {
  const draft = useSessionDetail().data?.draft;

  return (
    <>
      <header className="border-border flex items-center gap-3 border-b px-4 py-3">
        {tabs}
        <StatusChip className="shrink-0" />
      </header>

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        defaultSelectedKey="conversation"
        variant="secondary">
        <Tabs.ListContainer className="border-border border-b px-4">
          <Tabs.List aria-label="Agent session view">
            <Tabs.Tab id="conversation">
              Conversation
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="draft">
              Draft
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel
          className="flex min-h-0 flex-1 flex-col p-0"
          id="conversation">
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
            placeholder="Ask the writing agent…"
            toolbar={<ModelPicker providerOrder={PROVIDER_ORDER} />}
          />
        </Tabs.Panel>

        <Tabs.Panel className="flex min-h-0 flex-1 p-0" id="draft">
          <AgentDraftPreview draft={draft} />
        </Tabs.Panel>
      </Tabs>
    </>
  );
};
