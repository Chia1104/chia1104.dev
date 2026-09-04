"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, Chip, Drawer } from "@heroui/react";
import { FileText, Languages, PencilLine } from "lucide-react";

import { ComposerAttachment } from "@chia/agent-elements/composer";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import type { RouterOutputs } from "@/libs/orpc/types";

type AgentDraft = NonNullable<
  RouterOutputs["agent"]["sessions"]["get"]["draft"]
>;
type DraftLocale = keyof AgentDraft["translations"];
type DraftTranslation = NonNullable<AgentDraft["translations"][DraftLocale]>;

type Selection =
  | { kind: "meta" }
  | { kind: "translation"; locale: DraftLocale };

/** Per-locale fields the apply step carries; shown even when empty so a gap is visible. */
const TRANSLATION_FIELDS = ["excerpt", "description", "summary"] as const;

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

const FeedMetaBody = ({ draft }: { draft: AgentDraft }) => (
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
  </div>
);

const TranslationBody = ({
  translation,
}: {
  translation: DraftTranslation;
}) => (
  <div className="flex flex-col gap-4">
    {TRANSLATION_FIELDS.map((field) => (
      <MetaField key={field} label={field} value={translation[field]} />
    ))}
    <pre className="bg-surface-secondary overflow-auto rounded-xl p-4 text-sm leading-6 whitespace-pre-wrap">
      {translation.content || "No content yet."}
    </pre>
  </div>
);

/** The session's shared draft; the editor link opens the same draft the agent is writing to. */
export const DraftAttachments = ({ draft }: { draft: AgentDraft }) => {
  const router = useRouter();
  const [selection, setSelection] = useState<Selection | null>(null);

  // SAFETY: `translations` is a `Partial<Record<Locale, …>>`; `Object.entries` widens its keys to
  // `string` and drops nothing else, so the pairs are exactly the locale-keyed entries.
  const translations = Object.entries(draft.translations) as [
    DraftLocale,
    DraftTranslation,
  ][];
  const selected =
    selection?.kind === "translation"
      ? draft.translations[selection.locale]
      : null;
  const heading =
    selection?.kind === "meta"
      ? "Draft metadata"
      : selection?.kind === "translation"
        ? selected?.title || "Untitled"
        : "";

  return (
    <>
      <ComposerAttachment
        icon={<FileText />}
        label="Draft"
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
        onPress={() => setSelection({ kind: "meta" })}
      />
      {translations.map(([locale, translation]) => (
        <ComposerAttachment
          key={locale}
          icon={<Languages />}
          label={translation.title || "Untitled"}
          meta={
            <span className="flex items-center gap-1">
              {translation.title ? null : <MissingChip label="missing title" />}
              <Chip size="sm" variant="soft">
                <Chip.Label>{locale}</Chip.Label>
              </Chip>
            </span>
          }
          onPress={() => setSelection({ kind: "translation", locale })}
        />
      ))}
      <Button
        onPress={() => router.push(`/feed/draft/${draft.id}`)}
        size="sm"
        variant="secondary">
        <PencilLine className="size-4" />
        Open in editor
      </Button>

      <Drawer.Backdrop
        isOpen={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}>
        <DrawerPanel>
          <Drawer.CloseTrigger />
          <Drawer.Header>
            <Drawer.Heading>{heading}</Drawer.Heading>
            {selection?.kind === "translation" ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>{selection.locale}</Chip.Label>
              </Chip>
            ) : null}
          </Drawer.Header>
          <Drawer.Body>
            {selection?.kind === "meta" ? (
              <FeedMetaBody draft={draft} />
            ) : selected ? (
              <TranslationBody translation={selected} />
            ) : null}
          </Drawer.Body>
        </DrawerPanel>
      </Drawer.Backdrop>
    </>
  );
};
