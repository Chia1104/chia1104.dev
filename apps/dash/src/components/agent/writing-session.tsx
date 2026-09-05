"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button, Chip } from "@heroui/react";
import { Paperclip } from "lucide-react";

import { Composer, ComposerAttachment } from "@chia/agent-elements/composer";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { useSessionDetail } from "@chia/agent-elements/provider";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { memoryToolRenderers } from "@chia/agent-elements/renderers/memory";
import { webToolRenderers } from "@chia/agent-elements/renderers/web";
import { SessionModelPicker } from "@chia/agent-elements/session-model-picker";
import { Thread } from "@chia/agent-elements/thread";

import { useCurrentDraft } from "./current-draft";
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

/** The draft open in the editor, attached to the next message unless the operator drops it. */
const CurrentDraftAttachment = ({
  attached,
  onChange,
}: {
  attached: boolean;
  onChange: (attached: boolean) => void;
}) => {
  const current = useCurrentDraft();
  if (!current) return null;
  const label = current.title ?? `Draft #${current.id}`;
  return (
    <ComposerAttachment
      icon={<Paperclip />}
      label={attached ? `Attach: ${label}` : `Not attached: ${label}`}
      meta={
        <Chip size="sm" variant="soft">
          <Chip.Label>#{current.id}</Chip.Label>
        </Chip>
      }
      action={
        attached ? null : (
          <Button onPress={() => onChange(true)} size="sm" variant="ghost">
            Attach
          </Button>
        )
      }
      onDismiss={attached ? () => onChange(false) : undefined}
    />
  );
};

export const WritingSession = ({ tabs }: { tabs: ReactNode }) => {
  const drafts = useSessionDetail().data?.drafts ?? [];
  const current = useCurrentDraft();
  const [attachCurrent, setAttachCurrent] = useState(true);
  // A different draft in the editor is offered afresh, whatever happened to the last one.
  useEffect(() => {
    setAttachCurrent(true);
  }, [current?.id]);

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
  const pendingAttachments = useMemo(
    () => (current && attachCurrent ? [{ type: "draft", id: current.id }] : []),
    [attachCurrent, current]
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
          current || drafts.length > 0 ? (
            <>
              <CurrentDraftAttachment
                attached={attachCurrent}
                onChange={setAttachCurrent}
              />
              <SessionDrafts
                drafts={drafts.filter((draft) => draft.id !== current?.id)}
              />
            </>
          ) : undefined
        }
        localCommands={localCommands}
        pendingAttachments={pendingAttachments}
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
