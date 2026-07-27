"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import {
  Button,
  Card,
  Chip,
  ScrollShadow,
  Spinner,
  Tabs,
  TextArea,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

import type { AgentViewState, ToolCallView } from "@chia/agent-core";
import { applyEvent, foldEvents } from "@chia/agent-core";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { AgentDraftPreview } from "./agent-draft-preview";
import { AgentTranscript } from "./agent-transcript";
import { useAgentStream } from "./use-agent-stream";

type AgentSessionDetail = RouterOutputs["agent"]["sessions"]["get"];

interface AgentSessionProps {
  sessionId: string;
  onSessionChanged: () => void;
}

interface AgentSessionContentProps extends AgentSessionProps {
  detail: AgentSessionDetail;
  refetch: () => Promise<unknown>;
}

interface PendingApproval {
  toolCallId: string;
  toolName: string;
  args?: unknown;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

const mergeApprovals = (
  serverApprovals: PendingApproval[],
  liveApprovals: ToolCallView[]
) => {
  const merged = new Map<string, PendingApproval>();
  for (const approval of serverApprovals) {
    merged.set(approval.toolCallId, approval);
  }
  for (const approval of liveApprovals) {
    merged.set(approval.toolCallId, {
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      args: approval.args,
    });
  }
  return [...merged.values()];
};

const statusMeta = {
  awaiting_approval: { color: "warning", label: "Needs approval" },
  error: { color: "danger", label: "Error" },
  idle: { color: "default", label: "Idle" },
  running: { color: "accent", label: "Running" },
} as const satisfies Record<
  AgentViewState["runStatus"],
  {
    color: "accent" | "danger" | "default" | "warning";
    label: string;
  }
>;

const AgentSessionContent = ({
  detail,
  onSessionChanged,
  refetch,
  sessionId,
}: AgentSessionContentProps) => {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState("");
  const [isTurnActive, setIsTurnActive] = useState(false);
  const [view, dispatch] = useReducer(applyEvent, detail.events, foldEvents);

  const refreshDetail = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.agent.sessions.get.queryKey({
        input: { sessionId },
      }),
    });
  }, [queryClient, sessionId]);

  const handleStreamEvent = useCallback(
    (event: Parameters<typeof applyEvent>[1]) => {
      dispatch(event);

      if (event.type === "run:end" || event.type === "error") {
        setIsTurnActive(false);
      }
      if (event.type === "state:changed" || event.type === "run:end") {
        void refreshDetail();
        onSessionChanged();
      }
    },
    [onSessionChanged, refreshDetail]
  );

  const { close, isConnected, start } = useAgentStream({
    onEvent: handleStreamEvent,
    onError: (error) => {
      setIsTurnActive(false);
      toast.error(`Agent stream disconnected: ${errorMessage(error)}`);
    },
    onClose: () => setIsTurnActive(false),
  });

  const pendingApprovals = useMemo(
    () => mergeApprovals(detail.pendingApprovals, view.pendingApprovals),
    [detail.pendingApprovals, view.pendingApprovals]
  );

  useEffect(() => {
    if (pendingApprovals.length === 0 || isConnected) return;
    void start({ sessionId, startIndex: -1 });
  }, [isConnected, pendingApprovals.length, sessionId, start]);

  const promptMutation = useMutation(
    orpc.agent.sessions.prompt.mutationOptions()
  );
  const approveMutation = useMutation(
    orpc.agent.sessions.approve.mutationOptions()
  );
  const abortMutation = useMutation(
    orpc.agent.sessions.abort.mutationOptions()
  );

  const send = useCallback(async () => {
    const text = message.trim();
    if (!text || isTurnActive || pendingApprovals.length > 0) return;

    setIsTurnActive(true);
    try {
      const result = await promptMutation.mutateAsync({ sessionId, text });
      setMessage("");
      if (!isConnected) {
        await start({
          sessionId,
          runId: result.runId,
          startIndex: result.startIndex,
        });
      }
    } catch (error) {
      setIsTurnActive(false);
      toast.error(errorMessage(error));
    }
  }, [
    isConnected,
    isTurnActive,
    message,
    pendingApprovals.length,
    promptMutation,
    sessionId,
    start,
  ]);

  const decide = useCallback(
    async (approval: PendingApproval, approved: boolean) => {
      try {
        if (!isConnected) {
          await start({ sessionId, startIndex: -1 });
        }
        await approveMutation.mutateAsync({
          sessionId,
          toolCallId: approval.toolCallId,
          approved,
        });
        dispatch({
          type: "approval:resolved",
          toolCallId: approval.toolCallId,
          approved,
        });
        setIsTurnActive(true);
        await refreshDetail();
      } catch (error) {
        setIsTurnActive(false);
        toast.error(errorMessage(error));
      }
    },
    [approveMutation, isConnected, refreshDetail, sessionId, start]
  );

  const abort = useCallback(async () => {
    try {
      const result = await abortMutation.mutateAsync({ sessionId });
      if (!result.aborted) return;
      await close();
      dispatch({ type: "run:end", reason: "aborted" });
      setIsTurnActive(false);
      await Promise.all([refreshDetail(), refetch()]);
      onSessionChanged();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [
    abortMutation,
    close,
    onSessionChanged,
    refetch,
    refreshDetail,
    sessionId,
  ]);

  const isBusy =
    isTurnActive || promptMutation.isPending || view.runStatus === "running";
  const composerDisabled = isBusy || pendingApprovals.length > 0;
  const meta =
    statusMeta[
      pendingApprovals.length > 0 ? "awaiting_approval" : view.runStatus
    ];

  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
      <Card.Header className="border-border flex-row items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <Card.Title className="truncate">
            {detail.session.title || "Untitled session"}
          </Card.Title>
          <Card.Description className="truncate">
            {detail.settings?.modelId ||
              detail.session.modelId ||
              "Writing agent"}
          </Card.Description>
        </div>
        <Chip className="ml-auto" color={meta.color} size="sm" variant="soft">
          <Chip.Label>{meta.label}</Chip.Label>
        </Chip>
        {isBusy ? (
          <Button
            aria-label="Stop agent"
            isIconOnly
            isPending={abortMutation.isPending}
            onPress={() => void abort()}
            size="sm"
            variant="danger-soft">
            <Square className="size-3.5 fill-current" />
          </Button>
        ) : null}
      </Card.Header>

      <Tabs
        className="flex min-h-0 flex-1 flex-col"
        defaultSelectedKey="conversation"
        variant="secondary">
        <Tabs.ListContainer className="border-border border-b px-4">
          <Tabs.List aria-label="Agent session view">
            <Tabs.Tab id="conversation">
              Conversation
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="draft">
              Draft
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>

        <Tabs.Panel
          className="flex min-h-0 flex-1 flex-col p-0"
          id="conversation">
          <AgentTranscript items={view.items} runStatus={view.runStatus} />

          {pendingApprovals.length > 0 ? (
            <ScrollShadow
              className="border-border max-h-64 shrink-0 border-t px-4 py-3"
              size={32}>
              <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                {pendingApprovals.map((approval) => (
                  <Card key={approval.toolCallId} variant="secondary">
                    <Card.Header className="flex-row items-center gap-2">
                      <CircleAlert className="text-warning size-4" />
                      <Card.Title className="text-sm">
                        Allow {approval.toolName}?
                      </Card.Title>
                    </Card.Header>
                    {approval.args !== undefined ? (
                      <Card.Content>
                        <pre className="bg-surface max-h-32 overflow-auto rounded-xl p-3 text-xs whitespace-pre-wrap">
                          {JSON.stringify(approval.args, null, 2)}
                        </pre>
                      </Card.Content>
                    ) : null}
                    <Card.Footer className="flex-row justify-end gap-2">
                      <Button
                        isPending={approveMutation.isPending}
                        onPress={() => void decide(approval, false)}
                        size="sm"
                        variant="danger-soft">
                        <X className="size-4" />
                        Reject
                      </Button>
                      <Button
                        isPending={approveMutation.isPending}
                        onPress={() => void decide(approval, true)}
                        size="sm">
                        <Check className="size-4" />
                        Approve
                      </Button>
                    </Card.Footer>
                  </Card>
                ))}
              </div>
            </ScrollShadow>
          ) : null}

          <div className="border-border bg-surface/80 shrink-0 border-t p-3 backdrop-blur">
            <div className="mx-auto flex w-full max-w-4xl items-end gap-2">
              <TextArea
                aria-label="Message writing agent"
                className="max-h-40 min-h-11 flex-1 resize-none"
                disabled={composerDisabled}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || event.shiftKey) return;
                  event.preventDefault();
                  void send();
                }}
                placeholder={
                  pendingApprovals.length > 0
                    ? "Approve or reject the pending tool first."
                    : "Ask the writing agent…"
                }
                rows={2}
                value={message}
                variant="secondary"
              />
              <Button
                aria-label="Send message"
                isDisabled={composerDisabled || !message.trim()}
                isIconOnly
                isPending={promptMutation.isPending}
                onPress={() => void send()}>
                <Send className="size-4" />
              </Button>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel className="flex min-h-0 flex-1 p-0" id="draft">
          <AgentDraftPreview draft={detail.draft} />
        </Tabs.Panel>
      </Tabs>
    </Card>
  );
};

export const AgentSession = ({
  onSessionChanged,
  sessionId,
}: AgentSessionProps) => {
  const query = useQuery(
    orpc.agent.sessions.get.queryOptions({
      input: { sessionId },
    })
  );

  if (query.isLoading) {
    return (
      <Card className="flex min-h-96 flex-1 items-center justify-center">
        <Spinner aria-label="Loading agent session" />
      </Card>
    );
  }

  if (query.isError || !query.data) {
    return (
      <Card className="flex min-h-96 flex-1 items-center justify-center text-center">
        <Card.Content className="items-center gap-3">
          <CircleAlert className="text-danger size-6" />
          <p>Unable to load this session.</p>
          <Button
            onPress={() => void query.refetch()}
            size="sm"
            variant="secondary">
            Try again
          </Button>
        </Card.Content>
      </Card>
    );
  }

  return (
    <AgentSessionContent
      detail={query.data}
      onSessionChanged={onSessionChanged}
      refetch={query.refetch}
      sessionId={sessionId}
    />
  );
};
