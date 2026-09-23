"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@heroui/react";
import { useThrottledCallback } from "@tanstack/react-pacer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { messageOf } from "@chia/utils/error-helper";

import { orpc } from "@/libs/orpc/client";

import { SUPPORTED_LOCALES } from "./constants";

const POLL_MS = 2000;

const localeLabel = (locale: string) =>
  SUPPORTED_LOCALES.find((supported) => supported.key === locale)?.label ??
  locale;

/** Shows the published summaries and tracks a requested summary run. */
export const PostSummary = ({
  feedId,
  published,
  translations,
}: {
  feedId: number;
  published: boolean;
  translations: { locale: string; summary: string | null }[];
}) => {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string | null>(null);
  const handledRunId = useRef<string | null>(null);

  const summarize = useMutation(
    orpc.feeds.summarize.mutationOptions({
      onSuccess: (started) => setRunId(started.runId),
      onError: (error) =>
        toast.error(messageOf(error, "Something went wrong.")),
    })
  );

  const run = useQuery(
    orpc.feeds["summarize:run"].queryOptions({
      input: { runId: runId ?? "" },
      enabled: runId !== null,
      staleTime: Infinity,
      refetchInterval: (query) => {
        if (query.state.status === "error") return false;
        const status = query.state.data?.status;
        return status === "pending" || status === "running" || !status
          ? POLL_MS
          : false;
      },
    })
  );

  useEffect(() => {
    if (!runId || handledRunId.current === runId) return;

    if (run.isError) {
      handledRunId.current = runId;
      setRunId(null);
      toast.error(messageOf(run.error, "Could not check the summary run."));
      return;
    }

    const result = run.data;
    if (!result || result.status === "pending" || result.status === "running") {
      return;
    }

    handledRunId.current = runId;
    setRunId(null);
    void queryClient.invalidateQueries({
      queryKey: orpc.feeds["details-by-id"].key({ input: { feedId } }),
    });
    const failed =
      result.output?.translations?.filter(
        (translation) => translation.status !== "ok"
      ) ?? [];
    if (result.status !== "completed" || result.output?.error) {
      toast.error(result.output?.error ?? `Summary run ${result.status}.`);
    } else if (failed.length > 0) {
      toast.warning(
        failed
          .map((translation) => `${translation.locale}: ${translation.status}`)
          .join("\n")
      );
    } else if (!result.output?.success) {
      toast.error("Summary run completed without a result.");
    } else {
      toast.success("Summary written");
    }
  }, [feedId, queryClient, run.data, run.error, run.isError, runId]);

  const isRunning = summarize.isPending || runId !== null;
  const requestSummary = useThrottledCallback(
    () => {
      if (isRunning || !published) return;
      summarize.mutate({ feedId });
    },
    { wait: 500, trailing: false }
  );

  return (
    <div className="flex basis-full flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Summary</p>
          <p className="text-muted text-xs">
            Written by the summary task from the published body; the draft never
            carries it.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          isDisabled={!published}
          isPending={isRunning}
          onPress={requestSummary}>
          <Sparkles className="size-4" />
          {translations.some((translation) => translation.summary)
            ? "Summarize again"
            : "Summarize"}
        </Button>
      </div>
      {!published ? (
        <p className="text-muted text-xs">Publish the post to summarise it.</p>
      ) : null}
      <dl className="flex flex-col gap-2">
        {translations.map((translation) => (
          <div key={translation.locale} className="flex flex-col gap-1">
            <dt className="text-muted text-xs">
              {localeLabel(translation.locale)}
            </dt>
            <dd className="text-sm leading-relaxed whitespace-pre-wrap">
              {translation.summary ?? (
                <span className="text-muted">No summary yet.</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
