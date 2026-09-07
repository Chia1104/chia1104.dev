"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { Button, Card, Chip, Drawer, Tabs } from "@heroui/react";
import { FileText, PencilLine } from "lucide-react";

import { ComposerAttachment } from "@chia/agent-elements/composer";
import { Expandable } from "@chia/agent-elements/expandable";
import { CopyButton } from "@chia/ui/copy-button";
import { cn } from "@chia/ui/utils/cn.util";
import dayjs from "@chia/utils/day";

import { DrawerPanel } from "@/components/commons/drawer-panel";
import { SUPPORTED_LOCALES } from "@/components/feed/constants";
import { useGuardedRouter } from "@/libs/navigation-guard";
import type { RouterOutputs } from "@/libs/orpc/types";

type AgentDraft = NonNullable<
  RouterOutputs["agent"]["sessions"]["get"]["drafts"]
>[number];
type DraftLocale = keyof AgentDraft["translations"];
type DraftTranslation = NonNullable<AgentDraft["translations"][DraftLocale]>;

/** Per-locale prose the apply step carries; shown even when empty so a gap is visible. */
const TRANSLATION_FIELDS = ["excerpt", "description", "summary"] as const;

/** Longer bodies open collapsed so the meta above them stays on screen. */
const CONTENT_MAX_HEIGHT = 320;

const titleOf = (draft: AgentDraft) =>
  draft.translations[draft.defaultLocale]?.title ??
  Object.values(draft.translations).find((t) => t?.title)?.title ??
  null;

const localeLabel = (locale: DraftLocale) =>
  SUPPORTED_LOCALES.find((supported) => supported.key === locale)?.label ??
  locale;

const MissingChip = ({ label }: { label: string }) => (
  <Chip color="warning" size="sm" variant="soft">
    <Chip.Label>{label}</Chip.Label>
  </Chip>
);

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="truncate">{value}</dd>
  </>
);

const ProseField = ({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-muted text-xs font-medium uppercase">{label}</span>
    <p className={cn("text-sm", value ? null : "text-muted")}>{value || "—"}</p>
  </div>
);

/** Applying is what turns a draft into a post, so the drawer leads with its distance from the feed. */
const ApplyStateChip = ({ draft }: { draft: AgentDraft }) => {
  if (draft.feedId === null)
    return (
      <Chip size="sm" variant="soft">
        <Chip.Label>Not applied yet</Chip.Label>
      </Chip>
    );
  return draft.appliedRevision === draft.revision ? (
    <Chip color="success" size="sm" variant="soft">
      <Chip.Label>In sync with feed #{draft.feedId}</Chip.Label>
    </Chip>
  ) : (
    <Chip color="warning" size="sm" variant="soft">
      <Chip.Label>Ahead of feed #{draft.feedId}</Chip.Label>
    </Chip>
  );
};

const ContentPreview = ({ content }: { content: string | null }) => {
  if (!content)
    return (
      <p className="border-border text-muted rounded-xl border border-dashed p-4 text-sm">
        No body yet. Ask the agent to write one, or open the draft in the
        editor.
      </p>
    );

  return (
    <div className="relative">
      <Expandable
        className="bg-surface-secondary rounded-xl p-4 text-sm leading-6"
        maxHeight={CONTENT_MAX_HEIGHT}
        toggleClassName="-mr-2 -mb-1 justify-end pt-1">
        {/* Only the body clears the copy button; the toggle below it lines up with that button's edge. */}
        <pre className="pr-8 break-words whitespace-pre-wrap">{content}</pre>
      </Expandable>
      {/* Copies the whole body, not the clipped preview. */}
      <CopyButton
        className="absolute top-2 right-2 size-7 min-w-7"
        content={content}
        translations={{ copied: "Copied", copy: "Copy the body" }}
        variant="secondary"
      />
    </div>
  );
};

const LocalePanel = ({ translation }: { translation: DraftTranslation }) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-base font-medium">
        {translation.title || "Untitled"}
      </h3>
      {translation.title ? null : <MissingChip label="needs a title" />}
    </div>
    {TRANSLATION_FIELDS.map((field) => (
      <ProseField key={field} label={field} value={translation[field]} />
    ))}
    <ContentPreview content={translation.content} />
  </div>
);

const DraftBody = ({ draft }: { draft: AgentDraft }) => {
  // SAFETY: `translations` is a `Partial<Record<Locale, …>>`; `Object.entries` widens its keys to
  // `string` and drops nothing else, so the pairs are exactly the locale-keyed entries.
  const translations = Object.entries(draft.translations) as [
    DraftLocale,
    DraftTranslation,
  ][];

  return (
    <div className="flex flex-col gap-5">
      <Card className="w-full" variant="secondary">
        <Card.Header className="flex-row flex-wrap items-center justify-between gap-2">
          <Card.Title className="text-sm">Draft #{draft.id}</Card.Title>
          <ApplyStateChip draft={draft} />
        </Card.Header>
        <Card.Content>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Field
              label="Slug"
              value={
                draft.slug ? (
                  <span className="font-mono">{draft.slug}</span>
                ) : draft.feedId === null ? (
                  // A first apply creates the post's URL, so only an unapplied draft is blocked without one.
                  <MissingChip label="required to apply" />
                ) : (
                  "—"
                )
              }
            />
            <Field label="Type" value={draft.type} />
            <Field
              label="Default locale"
              value={localeLabel(draft.defaultLocale)}
            />
            <Field
              label="Main image"
              value={
                draft.mainImage ? (
                  <span className="font-mono">{draft.mainImage}</span>
                ) : (
                  "—"
                )
              }
            />
            <Field label="Revision" value={`r${draft.revision}`} />
            {draft.feedId === null ? null : (
              <Field
                label="Applied"
                value={
                  draft.appliedRevision === null
                    ? "—"
                    : `r${draft.appliedRevision}`
                }
              />
            )}
            <Field label="Updated" value={dayjs(draft.updatedAt).fromNow()} />
          </dl>
        </Card.Content>
      </Card>

      {translations.length === 0 ? (
        <p className="border-border text-muted rounded-xl border border-dashed p-4 text-sm">
          No locale has been written yet.
        </p>
      ) : (
        <Tabs defaultSelectedKey={draft.defaultLocale}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Locale">
              {translations.map(([locale, translation]) => (
                <Tabs.Tab key={locale} id={locale}>
                  <div className="flex items-center gap-1.5">
                    <span>{localeLabel(locale)}</span>
                    {translation.title ? null : (
                      <Chip color="warning" size="sm" variant="soft">
                        <Chip.Label className="text-xs">no title</Chip.Label>
                      </Chip>
                    )}
                  </div>
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {translations.map(([locale, translation]) => (
            <Tabs.Panel key={locale} className="pt-4" id={locale}>
              <LocalePanel translation={translation} />
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
    </div>
  );
};

/** The drafts this session has worked on, most recent first; each opens the same row the editor edits. */
export const SessionDrafts = ({ drafts }: { drafts: AgentDraft[] }) => {
  const router = useGuardedRouter();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = drafts.find((draft) => draft.id === selectedId) ?? null;

  const openInEditor = (draftId: number) => {
    // Read on press rather than through `useSearchParams`, which would re-render the drawer on every URL change.
    const params = new URLSearchParams(window.location.search);
    params.set("agent", "open");
    router.push(`/feed/draft/${draftId}?${params.toString()}`);
  };

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
            {selected ? <DraftBody key={selected.id} draft={selected} /> : null}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              className="w-full sm:w-auto"
              isDisabled={selected === null}
              onPress={() => {
                if (selected) openInEditor(selected.id);
              }}
              size="sm"
              variant="secondary">
              <PencilLine className="size-4" />
              Open in editor
            </Button>
          </Drawer.Footer>
        </DrawerPanel>
      </Drawer.Backdrop>
    </>
  );
};
