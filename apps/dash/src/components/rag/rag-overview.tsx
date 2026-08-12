"use client";

import { Card, Chip, Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { CoverageBar, IndexKeyLine } from "./rag-shared";
import type { IndexCounts } from "./rag-shared";

type Overview = RouterOutputs["rag"]["overview"];

const StatCard = ({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) => (
  <Card className="w-full">
    <Card.Content className="flex flex-col gap-1 py-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-2xl font-semibold tabular-nums">{value}</span>
      {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
    </Card.Content>
  </Card>
);

const CountsRow = ({
  label,
  counts,
}: {
  label: string;
  counts: IndexCounts;
}) => (
  <div className="flex items-center justify-between gap-4 py-1.5">
    <span className="text-sm">{label}</span>
    <span className="text-muted-foreground font-mono text-xs tabular-nums">
      {counts.current} / {counts.total}
      {counts.stale > 0 && ` · ${counts.stale} stale`}
      {counts.missing > 0 && ` · ${counts.missing} missing`}
    </span>
  </div>
);

const Breakdown = ({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; counts: IndexCounts }[];
}) => (
  <Card className="w-full">
    <Card.Header>
      <Card.Title className="text-sm">{title}</Card.Title>
    </Card.Header>
    <Card.Content className="divide-border divide-y">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">No data</p>
      ) : (
        rows.map((row) => (
          <CountsRow key={row.key} counts={row.counts} label={row.label} />
        ))
      )}
    </Card.Content>
  </Card>
);

const IndexKeyTable = ({ rows }: { rows: Overview["byIndexKey"] }) => (
  <Card className="w-full">
    <Card.Header>
      <Card.Title className="text-sm">Vectors per index key</Card.Title>
      <Card.Description className="text-xs">
        A key other than the current one is a leftover the maintenance page can
        drop.
      </Card.Description>
    </Card.Header>
    <Card.Content className="divide-border divide-y">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-2 text-sm">No vectors stored</p>
      ) : (
        rows.map((row) => (
          <div
            key={`${row.model}:${row.indexVersion}`}
            className="flex items-center justify-between gap-4 py-1.5">
            <span className="font-mono text-xs">
              {row.model} · {row.indexVersion}
            </span>
            <span className="font-mono text-xs tabular-nums">{row.count}</span>
          </div>
        ))
      )}
    </Card.Content>
  </Card>
);

export const RagOverview = () => {
  const { data, isLoading, error } = useQuery(orpc.rag.overview.queryOptions());

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <p className="text-danger py-8 text-sm">
        {error?.message ?? "Could not load the RAG overview"}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <IndexKeyLine
          indexVersion={data.indexVersion}
          model={data.model}
          className="text-sm"
        />
        {data.activeRunId && (
          <Chip color="warning" size="sm" variant="soft">
            <Chip.Label>A full reindex is in flight</Chip.Label>
          </Chip>
        )}
      </div>

      <CoverageBar counts={data.counts} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Chunks" value={data.counts.total} />
        <StatCard label="Embedded" value={data.counts.current} />
        <StatCard
          hint="vector exists, but under an older key"
          label="Stale"
          value={data.counts.stale}
        />
        <StatCard label="Missing" value={data.counts.missing} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown
          rows={data.bySourceType.map((row) => ({
            key: row.sourceType,
            label: row.sourceType,
            counts: row.counts,
          }))}
          title="By source type"
        />
        <Breakdown
          rows={data.byLocale.map((row) => ({
            key: row.locale ?? "none",
            label: row.locale ?? "(no locale)",
            counts: row.counts,
          }))}
          title="By locale"
        />
        <Breakdown
          rows={data.byKind.map((row) => ({
            key: row.kind,
            label: row.kind,
            counts: row.counts,
          }))}
          title="By chunk kind"
        />
        <Breakdown
          rows={data.byVisibility.map((row) => ({
            key: `${row.published}:${row.deleted}`,
            label: row.deleted
              ? "deleted"
              : row.published
                ? "published"
                : "draft",
            counts: row.counts,
          }))}
          title="By visibility"
        />
      </div>

      <IndexKeyTable rows={data.byIndexKey} />
    </div>
  );
};
