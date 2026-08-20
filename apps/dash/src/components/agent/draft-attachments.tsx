"use client";

import { useState } from "react";

import { Chip, Drawer } from "@heroui/react";
import { FileText, Languages } from "lucide-react";

import { ComposerAttachment } from "@chia/agent-elements/composer";
import useIsMobile from "@chia/ui/utils/use-is-mobile";

import type { RouterOutputs } from "@/libs/orpc/types";

type AgentDraft = NonNullable<
  RouterOutputs["agent"]["sessions"]["get"]["draft"]
>;
type DraftLocale = keyof AgentDraft["translations"];
type DraftTranslation = NonNullable<AgentDraft["translations"][DraftLocale]>;

type Selection =
  | { kind: "meta" }
  | { kind: "translation"; locale: DraftLocale };

/** Per-locale fields `commit_draft` carries; shown even when empty so a gap is visible. */
const TRANSLATION_FIELDS = ["excerpt", "description", "summary"] as const;

const jsonOf = <TValue,>(value: TValue) => JSON.stringify(value, null, 2);

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
  <pre className="bg-surface-secondary overflow-x-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
    {jsonOf(draft.feedMeta)}
  </pre>
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

/**
 * The writing draft as composer attachments — feed metadata plus one row per locale — each
 * opening a drawer with the full content. Slides in from the right on desktop, up from the
 * bottom on phones.
 */
export const DraftAttachments = ({ draft }: { draft: AgentDraft }) => {
  const [selection, setSelection] = useState<Selection | null>(null);
  const isMobile = useIsMobile("(max-width: 767px)");

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
      ? "Feed metadata"
      : selection?.kind === "translation"
        ? selected?.title || "Untitled"
        : "";

  return (
    <>
      <ComposerAttachment
        icon={<FileText />}
        label="Feed metadata"
        meta={
          draft.committedFeedId ? (
            <Chip color="success" size="sm" variant="soft">
              <Chip.Label>Feed #{draft.committedFeedId}</Chip.Label>
            </Chip>
          ) : null
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

      <Drawer.Backdrop
        isOpen={selection !== null}
        onOpenChange={(open) => {
          if (!open) setSelection(null);
        }}>
        <Drawer.Content placement={isMobile ? "bottom" : "right"}>
          <Drawer.Dialog className={isMobile ? undefined : "w-full max-w-2xl"}>
            {isMobile ? <Drawer.Handle /> : null}
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
          </Drawer.Dialog>
        </Drawer.Content>
      </Drawer.Backdrop>
    </>
  );
};
