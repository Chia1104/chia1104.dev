"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Chip, Drawer } from "@heroui/react";
import { FileText, PencilLine } from "lucide-react";

import { ComposerAttachment } from "@chia/agent-elements/composer";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import type { RouterOutputs } from "@/libs/orpc/types";

type AgentDraft = NonNullable<
  RouterOutputs["agent"]["sessions"]["get"]["drafts"]
>[number];
type DraftLocale = keyof AgentDraft["translations"];
type DraftTranslation = NonNullable<AgentDraft["translations"][DraftLocale]>;

/** Per-locale fields the apply step carries; shown even when empty so a gap is visible. */
const TRANSLATION_FIELDS = ["excerpt", "description", "summary"] as const;

const titleOf = (draft: AgentDraft) =>
  draft.translations[draft.defaultLocale]?.title ??
  Object.values(draft.translations).find((t) => t?.title)?.title ??
  null;

const MissingChip = ({ label }: { label: string }) => (
  <Chip color="warning" size="sm" variant="soft">
    <Chip.Label>{label}</Chip.Label>
  </Chip>
);

const MetaField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className="text-muted text-xs font-medium uppercase">{label}</span>
      {value ? null : <MissingChip label="missing" />}
    </div>
    {value ? <p className="text-sm">{value}</p> : null}
  </div>
);

const DraftBody = ({ draft }: { draft: AgentDraft }) => {
  const router = useRouter();
  // SAFETY: `translations` is a `Partial<Record<Locale, …>>`; `Object.entries` widens its keys to
  // `string` and drops nothing else, so the pairs are exactly the locale-keyed entries.
  const translations = Object.entries(draft.translations) as [
    DraftLocale,
    DraftTranslation,
  ][];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <MetaField label="slug" value={draft.slug} />
        <MetaField label="type" value={draft.type} />
        <MetaField label="default locale" value={draft.defaultLocale} />
        <MetaField label="main image" value={draft.mainImage} />
        <p className="text-muted text-xs">
          Revision {draft.revision}
          {draft.feedId === null
            ? " · not yet created as a post"
            : draft.appliedRevision === draft.revision
              ? ` · applied to feed #${draft.feedId}`
              : ` · feed #${draft.feedId} has unapplied changes`}
        </p>
        <Button
          onPress={() => router.push(`/feed/draft/${draft.id}?agent=open`)}
          size="sm"
          variant="secondary">
          <PencilLine className="size-4" />
          Open in editor
        </Button>
      </div>
      {translations.map(([locale, translation]) => (
        <div key={locale} className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="soft">
              <Chip.Label>{locale}</Chip.Label>
            </Chip>
            <span className="text-sm font-medium">
              {translation.title || "Untitled"}
            </span>
            {translation.title ? null : <MissingChip label="missing title" />}
          </div>
          {TRANSLATION_FIELDS.map((field) => (
            <MetaField key={field} label={field} value={translation[field]} />
          ))}
          <pre className="bg-surface-secondary overflow-auto rounded-xl p-4 text-sm leading-6 whitespace-pre-wrap">
            {translation.content || "No content yet."}
          </pre>
        </div>
      ))}
    </div>
  );
};

/** The drafts this session has worked on, most recent first; each opens the same row the editor edits. */
export const SessionDrafts = ({ drafts }: { drafts: AgentDraft[] }) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = drafts.find((draft) => draft.id === selectedId) ?? null;

  return (
    <>
      {drafts.map((draft) => (
        <ComposerAttachment
          key={draft.id}
          icon={<FileText />}
          label={titleOf(draft) ?? `Draft #${draft.id}`}
          meta={
            <span className="flex items-center gap-1">
              {draft.feedId !== null ? (
                <Chip color="success" size="sm" variant="soft">
                  <Chip.Label>Feed #{draft.feedId}</Chip.Label>
                </Chip>
              ) : null}
              <Chip size="sm" variant="soft">
                <Chip.Label>r{draft.revision}</Chip.Label>
              </Chip>
            </span>
          }
          onPress={() => setSelectedId(draft.id)}
        />
      ))}

      <Drawer.Backdrop
        isOpen={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}>
        <DrawerPanel>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>
              {selected ? (titleOf(selected) ?? `Draft #${selected.id}`) : ""}
            </Drawer.Heading>
          </Drawer.Header>
          <Drawer.Body>
            {selected ? <DraftBody draft={selected} /> : null}
          </Drawer.Body>
        </DrawerPanel>
      </Drawer.Backdrop>
    </>
  );
};
