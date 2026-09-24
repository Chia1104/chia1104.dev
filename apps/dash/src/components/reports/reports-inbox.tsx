"use client";

import Link from "next/link";

import { Card, Chip, Spinner, Tabs } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { FeedReportStatus } from "@chia/db/schema";
import { formatDateTime } from "@chia/utils/format";

import { orpc } from "@/libs/orpc/client";

import { CATEGORY_LABEL, STATUS_LABEL, STATUSES, VERDICT } from "./labels";
import type { ReportView } from "./labels";

const ReportRow = ({ report }: { report: ReportView }) => (
  <Link
    className="border-border hover:bg-surface-secondary flex flex-col gap-2 rounded-2xl border p-3 transition-colors"
    href={`/reports/${report.id}`}>
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-sm font-medium">
        {report.post.title ?? report.post.slug}
      </p>
      <Chip size="sm" variant="soft">
        <Chip.Label className="text-xs">
          {CATEGORY_LABEL[report.category]}
        </Chip.Label>
      </Chip>
      {report.triage ? (
        <Chip
          color={VERDICT[report.triage.verdict].color}
          size="sm"
          variant="soft">
          <Chip.Label className="text-xs">
            {VERDICT[report.triage.verdict].label}
          </Chip.Label>
        </Chip>
      ) : null}
      {report.triage && report.triage.edits.length > 0 ? (
        <Chip color="accent" size="sm" variant="soft">
          <Chip.Label className="text-xs">
            {report.triage.edits.length} edit
            {report.triage.edits.length === 1 ? "" : "s"}
          </Chip.Label>
        </Chip>
      ) : null}
      <span className="text-muted ml-auto text-xs">
        {formatDateTime(report.createdAt)}
      </span>
    </div>
    <p className="text-muted line-clamp-2 text-xs">{report.claim}</p>
  </Link>
);

/** The queue a report lands in; triage and the email arrive before the operator opens it. */
export const ReportsInbox = () => {
  const [status, setStatus] = useQueryState(
    "status",
    parseAsStringLiteral(STATUSES).withDefault(FeedReportStatus.Open)
  );
  const { data, isLoading } = useQuery(
    orpc.reports.list.queryOptions({ input: { status } })
  );
  const items = data?.items ?? [];

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs
        selectedKey={status}
        onSelectionChange={(key) => {
          const next = STATUSES.find((candidate) => candidate === key);
          if (next) void setStatus(next);
        }}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Report status">
            {STATUSES.map((candidate) => (
              <Tabs.Tab key={candidate} id={candidate}>
                {STATUS_LABEL[candidate]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>

      <p className="text-muted text-xs">
        Signed-in readers file these through the reading assistant. The claim
        and the assessments are unverified; nothing reaches the post until you
        apply its draft.
      </p>

      <Card className="w-full">
        <Card.Content className="flex flex-col gap-3">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted py-4 text-center text-sm">
              No {STATUS_LABEL[status].toLowerCase()} reports
            </p>
          ) : (
            items.map((report) => <ReportRow key={report.id} report={report} />)
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
