"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { Button, Chip, Skeleton, Spinner, Tabs } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Locale } from "@chia/db/types";
import useTheme from "@chia/ui/utils/use-theme";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import type { DraftView } from "./draft-values";

const DiffEditor = dynamic(
  () => import("@monaco-editor/react").then((module) => module.DiffEditor),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[55vh] w-full rounded-2xl" />,
  }
);

type Snapshot = RouterOutputs["feeds"]["draft:revision"]["snapshot"];

const LOCALES = [Locale.zhTW, Locale.En] as const;
const LOCALE_LABEL = { [Locale.zhTW]: "中文", [Locale.En]: "English" } as const;
const FEED_FIELDS = ["slug", "type", "defaultLocale", "mainImage"] as const;
const LOCALE_FIELDS = ["title", "excerpt", "description", "summary"] as const;

/** What the version is read against: the state before it, or the draft as it stands. */
const MODES = [
  { id: "changes", label: "What this version changed" },
  { id: "current", label: "What restoring it would change" },
] as const;

type Mode = (typeof MODES)[number]["id"];

interface FieldChange {
  field: string;
  before: string | null;
  after: string | null;
}

const changedFields = <TField extends string>(
  fields: readonly TField[],
  before: Partial<Record<TField, string | null>> | undefined,
  after: Partial<Record<TField, string | null>> | undefined
): FieldChange[] =>
  fields.flatMap((field) => {
    const from = before?.[field] ?? null;
    const to = after?.[field] ?? null;
    return from === to ? [] : [{ field, before: from, after: to }];
  });

const FieldChanges = ({ changes }: { changes: FieldChange[] }) =>
  changes.length === 0 ? null : (
    <dl className="flex flex-col gap-2 text-xs">
      {changes.map((change) => (
        <div key={change.field} className="flex flex-col gap-0.5">
          <dt className="text-muted font-mono">{change.field}</dt>
          <dd className="flex flex-col gap-0.5">
            {change.before === null ? null : (
              <del className="text-danger decoration-danger/50 break-words">
                {change.before || "(empty)"}
              </del>
            )}
            {change.after === null ? null : (
              <ins className="text-success break-words no-underline">
                {change.after || "(empty)"}
              </ins>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );

const LocaleDiff = ({
  before,
  after,
  locale,
}: {
  before: Snapshot | null;
  after: Snapshot;
  locale: Locale;
}) => {
  const { isDarkMode } = useTheme();
  const from = before?.translations[locale];
  const to = after.translations[locale];
  const fields = changedFields(LOCALE_FIELDS, from, to);
  const original = from?.content ?? "";
  const modified = to?.content ?? "";

  return (
    <div className="flex flex-col gap-4">
      <FieldChanges changes={fields} />
      {original === modified ? (
        <p className="text-muted text-xs">
          {fields.length === 0 ? "Nothing differs." : "The body is the same."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl">
          <DiffEditor
            height="55vh"
            language="markdown"
            loading={<Spinner size="sm" />}
            modified={modified}
            original={original}
            theme={isDarkMode ? "vs-dark" : "light"}
            options={{
              readOnly: true,
              renderSideBySide: false,
              hideUnchangedRegions: { enabled: true },
              diffWordWrap: "on",
              wordWrap: "on",
              lineNumbers: "off",
              minimap: { enabled: false },
              renderOverviewRuler: false,
              scrollBeyondLastLine: false,
            }}
          />
        </div>
      )}
    </div>
  );
};

/** One kept state against the state before it, or against the draft it would replace. */
export const RevisionDiff = ({
  draft,
  revisionId,
  onBack,
  onRestore,
  isRestoring,
  isDisabled,
}: {
  draft: DraftView;
  revisionId: number;
  onBack: () => void;
  onRestore: (revisionId: number) => void;
  isRestoring: boolean;
  isDisabled: boolean;
}) => {
  const [mode, setMode] = useState<Mode>("changes");
  const revision = useQuery(
    orpc.feeds["draft:revision"].queryOptions({
      input: { draftId: draft.id, revisionId },
      staleTime: Infinity,
    })
  );

  if (!revision.data)
    return (
      <div className="flex justify-center py-8">
        {revision.isError ? (
          <p className="text-danger text-sm">{revision.error.message}</p>
        ) : (
          <Spinner size="sm" />
        )}
      </div>
    );

  const after = revision.data.snapshot;
  const before: Snapshot | null =
    mode === "current" ? draft : revision.data.base;
  const feedChanges = changedFields(FEED_FIELDS, before ?? undefined, after);
  const locales = LOCALES.filter(
    (locale) => before?.translations[locale] ?? after.translations[locale]
  );
  const differing = locales.filter((locale) => {
    const from = before?.translations[locale];
    const to = after.translations[locale];
    return (
      (from?.content ?? "") !== (to?.content ?? "") ||
      changedFields(LOCALE_FIELDS, from, to).length > 0
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          aria-label="Back to versions"
          isIconOnly
          onPress={onBack}
          size="sm"
          variant="tertiary">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="font-mono text-xs">
          {revision.data.contentHash.slice(0, 7)}
        </span>
        <Chip
          color={revision.data.author === "agent" ? "accent" : "default"}
          size="sm"
          variant="soft">
          <Chip.Label>{revision.data.author}</Chip.Label>
        </Chip>
        <span className="text-muted text-xs">
          {dayjs(revision.data.createdAt).format("MMM D, HH:mm")}
        </span>
        <Button
          className="ml-auto"
          isDisabled={
            revision.data.contentHash === draft.contentHash || isDisabled
          }
          isPending={isRestoring}
          onPress={() => onRestore(revisionId)}
          size="sm"
          variant="secondary">
          Restore
        </Button>
      </div>
      {revision.data.message ? (
        <p className="text-sm">{revision.data.message}</p>
      ) : null}

      <div
        aria-label="Compared with"
        className="flex flex-wrap gap-1"
        role="group">
        {MODES.map(({ id, label }) => (
          <Button
            key={id}
            aria-pressed={mode === id}
            onPress={() => setMode(id)}
            size="sm"
            variant={mode === id ? "secondary" : "tertiary"}>
            {label}
          </Button>
        ))}
      </div>

      <FieldChanges changes={feedChanges} />
      {locales.length === 0 ? (
        <p className="text-muted text-xs">Neither side has a translation.</p>
      ) : (
        // Remounted per mode so it opens on a locale that differs under that comparison.
        <Tabs
          key={mode}
          defaultSelectedKey={differing[0] ?? after.defaultLocale}>
          <Tabs.ListContainer>
            <Tabs.List aria-label="Locale">
              {locales.map((locale) => (
                <Tabs.Tab key={locale} id={locale}>
                  {LOCALE_LABEL[locale]}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {locales.map((locale) => (
            <Tabs.Panel key={locale} className="pt-4" id={locale}>
              <LocaleDiff after={after} before={before} locale={locale} />
            </Tabs.Panel>
          ))}
        </Tabs>
      )}
    </div>
  );
};
