"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Button, Card, Chip, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

import { formatDateTime } from "@chia/utils/format";

import { orpc } from "@/libs/orpc/client";

import { CATEGORY_LABEL, STATUS_LABEL, VERDICT } from "./labels";
import type { ReportStatus, ReportView } from "./labels";

const LOCALE_LABEL = { "zh-TW": "中文", en: "English" } as const;
const TRIAGE_POLL_MS = 2000;

/** Reader and model text is shown as-is inside a block, never rendered as markdown. */
const Quoted = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <p className="text-muted text-xs">{label}</p>
    <blockquote className="border-border bg-surface-secondary rounded-xl border-l-2 px-3 py-2 text-sm break-words whitespace-pre-wrap">
      {children}
    </blockquote>
  </div>
);

const SuggestedEdits = ({
  triage,
}: {
  triage: NonNullable<ReportView["triage"]>;
}) => (
  <div className="flex flex-col gap-3">
    {triage.edits.map((edit, index) => (
      <div
        key={`${edit.locale}-${index}`}
        className="border-border flex flex-col gap-1 rounded-xl border p-3 text-xs">
        <span className="text-muted">{LOCALE_LABEL[edit.locale]}</span>
        <del className="text-danger decoration-danger/50 break-words whitespace-pre-wrap">
          {edit.find}
        </del>
        <ins className="text-success break-words whitespace-pre-wrap no-underline">
          {edit.replace || "(removed)"}
        </ins>
      </div>
    ))}
    {triage.droppedEdits > 0 ? (
      <p className="text-muted text-xs">
        {triage.droppedEdits} suggestion
        {triage.droppedEdits === 1 ? " was" : "s were"} dropped because it did
        not match the published text exactly once.
      </p>
    ) : null}
  </div>
);

const useReportMutations = (id: number) => {
  const queryClient = useQueryClient();
  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.reports.key() }),
      queryClient.invalidateQueries({ queryKey: orpc.feeds.key() }),
    ]);

  const setStatus = useMutation(
    orpc.reports["status:set"].mutationOptions({
      async onSuccess(result) {
        await invalidate();
        toast.success(
          `Report ${STATUS_LABEL[result.report.status].toLowerCase()}`
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const applyEdits = useMutation(
    orpc.reports["edits:apply"].mutationOptions({
      async onSuccess() {
        await invalidate();
        toast.success(
          "Suggestions written to the draft. Review and apply it from the editor."
        );
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  return {
    setStatus: (status: ReportStatus) => setStatus.mutate({ id, status }),
    settingStatus: setStatus.isPending ? setStatus.variables?.status : null,
    applyEdits: () => applyEdits.mutate({ id }),
    applying: applyEdits.isPending,
  };
};

/** Starts a triage run on the report and follows it until it settles; the report query is refreshed then. */
const useTriageRun = (id: number) => {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const handledRunId = useRef<string | null>(null);

  const start = useMutation(
    orpc.reports["triage:start"].mutationOptions({
      onSuccess: (started) => setRunId(started.runId),
      onError: (error) => toast.error(error.message),
    })
  );

  const run = useQuery(
    orpc.reports["triage:run"].queryOptions({
      input: { runId: runId ?? "" },
      enabled: runId !== null,
      staleTime: Infinity,
      refetchInterval: (query) => {
        if (query.state.status === "error") return false;
        const status = query.state.data?.status;
        return status === "pending" || status === "running" || !status
          ? TRIAGE_POLL_MS
          : false;
      },
    })
  );

  useEffect(() => {
    if (!runId || handledRunId.current === runId) return;

    if (run.isError) {
      handledRunId.current = runId;
      setRunId(null);
      toast.error(run.error.message);
      return;
    }

    const result = run.data;
    if (!result || result.status === "pending" || result.status === "running") {
      return;
    }

    handledRunId.current = runId;
    setRunId(null);
    void queryClient.invalidateQueries({ queryKey: orpc.reports.key() });
    if (result.status !== "completed" || !result.output) {
      toast.error(`Triage run ${result.status}.`);
    } else if (result.output.triage === "ok") {
      toast.success("Triage updated");
    } else {
      toast.warning(`Triage ended with "${result.output.triage}".`);
    }
  }, [queryClient, run.data, run.error, run.isError, runId]);

  return {
    start: () => start.mutate({ id }),
    running: start.isPending || runId !== null,
  };
};

const Actions = ({ report }: { report: ReportView }) => {
  const router = useRouter();
  const { setStatus, settingStatus, applyEdits, applying } = useReportMutations(
    report.id
  );
  const triageRun = useTriageRun(report.id);
  const active = report.status === "open" || report.status === "in_progress";
  const edits = report.triage?.edits.length ?? 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {active && edits > 0 ? (
        <Button
          isPending={applying}
          size="sm"
          variant="primary"
          onPress={applyEdits}>
          Write {edits} suggestion{edits === 1 ? "" : "s"} to the draft
        </Button>
      ) : null}
      {report.draftId !== null ? (
        <Button
          size="sm"
          variant="secondary"
          onPress={() => router.push(`/feed/draft/${report.draftId}`)}>
          Open draft
        </Button>
      ) : null}
      <Button
        isPending={triageRun.running}
        size="sm"
        variant="secondary"
        onPress={triageRun.start}>
        {report.triage ? "Rerun triage" : "Run triage"}
      </Button>
      {report.status === "open" ? (
        <Button
          isPending={settingStatus === "in_progress"}
          size="sm"
          variant="secondary"
          onPress={() => setStatus("in_progress")}>
          Take up
        </Button>
      ) : null}
      {active ? (
        <>
          <Button
            isPending={settingStatus === "resolved"}
            size="sm"
            variant="ghost"
            onPress={() => setStatus("resolved")}>
            Mark resolved
          </Button>
          <Button
            isPending={settingStatus === "dismissed"}
            size="sm"
            variant="danger-soft"
            onPress={() => setStatus("dismissed")}>
            Dismiss
          </Button>
        </>
      ) : (
        <Button
          isPending={settingStatus === "open"}
          size="sm"
          variant="ghost"
          onPress={() => setStatus("open")}>
          Reopen
        </Button>
      )}
    </div>
  );
};

export const ReportDetail = ({ id }: { id: number }) => {
  const { data, isLoading, error } = useQuery(
    orpc.reports.get.queryOptions({ input: { id } })
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="sm" />
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-muted text-sm">
        {error?.message ?? `Report ${id} not found`}
      </p>
    );
  }

  const { report } = data;
  const { triage } = report;

  return (
    <div className="flex w-full flex-col gap-6">
      <Link
        className="text-muted flex items-center gap-1 text-xs"
        href="/reports">
        <ArrowLeft className="size-3.5" />
        Reports
      </Link>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">
            {report.post.title ?? report.post.slug}
          </h1>
          <a
            aria-label="Open the post"
            className="text-muted"
            href={report.post.url}
            rel="noreferrer"
            target="_blank">
            <ExternalLink className="size-4" />
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant="soft">
            <Chip.Label className="text-xs">
              {STATUS_LABEL[report.status]}
            </Chip.Label>
          </Chip>
          <Chip size="sm" variant="soft">
            <Chip.Label className="text-xs">
              {CATEGORY_LABEL[report.category]}
            </Chip.Label>
          </Chip>
          <Chip size="sm" variant="soft">
            <Chip.Label className="text-xs">
              {LOCALE_LABEL[report.locale]}
            </Chip.Label>
          </Chip>
          <span className="text-muted text-xs">
            {formatDateTime(report.createdAt)}
            {report.reporter
              ? ` · ${report.reporter.name} <${report.reporter.email}>`
              : " · reader account deleted"}
          </span>
        </div>
      </div>

      <Actions report={report} />

      <Card className="w-full">
        <Card.Header>
          <Card.Title className="text-sm">What the reader reported</Card.Title>
          {report.headingPath ? (
            <Card.Description className="text-xs">
              Section: {report.headingPath}
            </Card.Description>
          ) : null}
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {report.quote ? (
            <Quoted label="Passage">{report.quote}</Quoted>
          ) : null}
          <Quoted label="Reader's claim">{report.claim}</Quoted>
          <Quoted label="Reading assistant's assessment">
            {report.assessment}
          </Quoted>
          {report.suggestion ? (
            <Quoted label="Suggested fix">{report.suggestion}</Quoted>
          ) : null}
        </Card.Content>
      </Card>

      <Card className="w-full">
        <Card.Header>
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-sm">Triage</Card.Title>
            {triage ? (
              <Chip
                color={VERDICT[triage.verdict].color}
                size="sm"
                variant="soft">
                <Chip.Label className="text-xs">
                  {VERDICT[triage.verdict].label}
                </Chip.Label>
              </Chip>
            ) : null}
          </div>
          <Card.Description className="text-xs">
            A model read the report against the published post. Check the claim
            yourself before you apply anything.
          </Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          {triage ? (
            <>
              <Quoted label="Summary">{triage.summary}</Quoted>
              {triage.edits.length > 0 || triage.droppedEdits > 0 ? (
                <SuggestedEdits triage={triage} />
              ) : (
                <p className="text-muted text-xs">No edits suggested.</p>
              )}
            </>
          ) : (
            <p className="text-muted text-xs">
              Triage has not run or produced nothing usable.
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
