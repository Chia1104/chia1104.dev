"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  Button,
  Card,
  Chip,
  ScrollShadow,
  Spinner,
  Tabs,
  TextArea,
} from "@heroui/react";
import { useChat } from "@tanstack/ai-react";
import type { ChatFetcher } from "@tanstack/ai-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, Send, Square, X } from "lucide-react";
import { toast } from "sonner";

import { client, orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import {
  agentEventsToUiMessages,
  latestUserText,
  mergePendingApprovals,
  nextApprovalContinuation,
  withAbortSignal,
} from "./agent-chat";
import type { PendingApproval } from "./agent-chat";
import { AgentDraftPreview } from "./agent-draft-preview";
import { AgentModelPicker } from "./agent-model-picker";
import { AgentTranscript } from "./agent-transcript";

type AgentSessionDetail = RouterOutputs["agent"]["sessions"]["get"];

interface AgentSessionProps {
  sessionId: string;
  onSessionChanged: () => void;
}

interface AgentSessionContentProps extends AgentSessionProps {
  detail: AgentSessionDetail;
  refetch: () => Promise<unknown>;
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

const statusMeta = {
  awaiting_approval: { color: "warning", label: "Needs approval" },
  error: { color: "danger", label: "Error" },
  idle: { color: "default", label: "Idle" },
  running: { color: "accent", label: "Running" },
} as const satisfies Record<
  "awaiting_approval" | "error" | "idle" | "running",
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
  const handledApprovalIdsRef = useRef(new Set<string>());

  const refreshDetail = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: orpc.agent.sessions.get.queryKey({
        input: { sessionId },
      }),
    });
  }, [queryClient, sessionId]);

  const initialMessages = useMemo(
    () => agentEventsToUiMessages(detail.events, detail.pendingApprovals),
    [detail.events, detail.pendingApprovals]
  );

  const fetcher = useCallback<ChatFetcher>(
    async ({ messages, runId, threadId }, { signal }) => {
      const approval = nextApprovalContinuation(
        messages,
        handledApprovalIdsRef.current
      );

      let action:
        | { type: "prompt"; text: string }
        | {
            type: "approve";
            toolCallId: string;
            approved: boolean;
          };
      if (approval) {
        handledApprovalIdsRef.current.add(approval.approvalId);
        action = {
          type: "approve",
          toolCallId: approval.approvalId,
          approved: approval.approved,
        };
      } else {
        const text = latestUserText(messages);
        if (!text) throw new Error("The agent prompt is empty.");
        action = { type: "prompt", text };
      }

      try {
        const stream = await client.agent.sessions.chat({
          sessionId,
          threadId,
          runId,
          action,
        });
        return withAbortSignal(stream, signal);
      } catch (error) {
        if (approval) {
          handledApprovalIdsRef.current.delete(approval.approvalId);
        }
        throw error;
      }
    },
    [sessionId]
  );

  const {
    addToolApprovalResponse,
    error,
    isLoading,
    messages,
    sendMessage,
    stop,
  } = useChat({
    threadId: sessionId,
    fetcher,
    initialMessages,
    queue: "drop",
    onChunk: (chunk) => {
      if (chunk.type !== "RUN_FINISHED" && chunk.type !== "RUN_ERROR") return;
      void refreshDetail();
      onSessionChanged();
    },
    onCustomEvent: (name) => {
      if (
        name !== "chia.agent.state-changed" &&
        name !== "chia.agent.session-compacted"
      ) {
        return;
      }
      void refreshDetail();
      onSessionChanged();
    },
    onError: (chatError) => {
      toast.error(`Agent stream disconnected: ${chatError.message}`);
    },
  });

  const pendingApprovals = useMemo(
    () => mergePendingApprovals(detail.pendingApprovals, messages),
    [detail.pendingApprovals, messages]
  );

  const abortMutation = useMutation(
    orpc.agent.sessions.abort.mutationOptions()
  );

  const send = useCallback(async () => {
    const text = message.trim();
    if (!text || isLoading || pendingApprovals.length > 0) return;

    setMessage("");
    try {
      await sendMessage(text);
    } catch (sendError) {
      setMessage(text);
      toast.error(errorMessage(sendError));
    }
  }, [isLoading, message, pendingApprovals.length, sendMessage]);

  const decide = useCallback(
    async (approval: PendingApproval, approved: boolean) => {
      try {
        await addToolApprovalResponse({
          id: approval.toolCallId,
          approved,
        });
        await refreshDetail();
      } catch (approvalError) {
        toast.error(errorMessage(approvalError));
      }
    },
    [addToolApprovalResponse, refreshDetail]
  );

  const abort = useCallback(async () => {
    try {
      const result = await abortMutation.mutateAsync({ sessionId });
      if (!result.aborted) return;
      stop();
      await Promise.all([refreshDetail(), refetch()]);
      onSessionChanged();
    } catch (abortError) {
      toast.error(errorMessage(abortError));
    }
  }, [
    abortMutation,
    onSessionChanged,
    refetch,
    refreshDetail,
    sessionId,
    stop,
  ]);

  const isBusy = isLoading || abortMutation.isPending;
  const composerDisabled = isBusy || pendingApprovals.length > 0;
  const meta =
    statusMeta[
      isLoading
        ? "running"
        : pendingApprovals.length > 0
          ? "awaiting_approval"
          : error
            ? "error"
            : "idle"
    ];

  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden p-0">
      <Card.Header className="border-border flex-row items-center gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <Card.Title className="truncate">
            {detail.session.title || "Untitled session"}
          </Card.Title>
          <AgentModelPicker
            kind={detail.session.kind}
            modelId={detail.settings?.modelId ?? undefined}
            onChanged={onSessionChanged}
            providerId={detail.settings?.providerId ?? undefined}
            sessionId={sessionId}
          />
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
          <AgentTranscript isRunning={isLoading} messages={messages} />

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
                        isPending={isLoading}
                        onPress={() => void decide(approval, false)}
                        size="sm"
                        variant="danger-soft">
                        <X className="size-4" />
                        Reject
                      </Button>
                      <Button
                        isPending={isLoading}
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
                  if (
                    event.key !== "Enter" ||
                    event.shiftKey ||
                    event.nativeEvent.isComposing
                  )
                    return;
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
                isPending={isLoading}
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
      key={sessionId}
      detail={query.data}
      onSessionChanged={onSessionChanged}
      refetch={query.refetch}
      sessionId={sessionId}
    />
  );
};
