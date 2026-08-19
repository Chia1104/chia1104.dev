"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button, Card } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus } from "lucide-react";
import { toast } from "sonner";

import { AgentSessionProvider } from "@chia/agent-elements/provider";
import { SessionTabs } from "@chia/agent-elements/session-tabs";
import agentLabels from "@chia/i18n/agent-elements/en-US.json";

import { client, orpc } from "@/libs/orpc/client";

import { WritingSession } from "./writing-session";

const WRITING_AGENT_KIND = "writing";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

export const AgentWorkspace = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const listOptions = orpc.agent.sessions.list.queryOptions({
    input: { kind: WRITING_AGENT_KIND, limit: 100 },
  });
  const sessionsQuery = useQuery(listOptions);
  const sessions = sessionsQuery.data?.items ?? [];
  const selectedSessionId =
    searchParams.get("session") ?? sessions.at(0)?.id ?? null;

  const selectSession = useCallback(
    (sessionId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("session", sessionId);
      router.replace(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const invalidateSessions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
  }, [listOptions.queryKey, queryClient]);

  const createMutation = useMutation(
    orpc.agent.sessions.create.mutationOptions({
      onSuccess: async (detail) => {
        selectSession(detail.session.id);
        await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
      },
    })
  );

  const createSession = useCallback(async () => {
    try {
      await createMutation.mutateAsync({ kind: WRITING_AGENT_KIND });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [createMutation]);

  const tabs = (
    <SessionTabs
      activeId={selectedSessionId}
      className="min-w-0 flex-1"
      isCreating={createMutation.isPending}
      labels={agentLabels}
      onCreate={() => void createSession()}
      onSelect={selectSession}
      sessions={sessions}
    />
  );

  return (
    <main className="flex h-[calc(100svh-4rem)] flex-col overflow-hidden p-4">
      <Card className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden p-0">
        {selectedSessionId ? (
          <AgentSessionProvider
            key={selectedSessionId}
            client={client.agent}
            kind={WRITING_AGENT_KIND}
            labels={agentLabels}
            onTurnEnd={invalidateSessions}
            sessionId={selectedSessionId}>
            <WritingSession tabs={tabs} />
          </AgentSessionProvider>
        ) : (
          <>
            <div className="border-border flex items-center gap-3 border-b px-4 py-3">
              {tabs}
            </div>
            <Card.Content className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <span className="bg-surface-secondary flex size-12 items-center justify-center rounded-full">
                <Bot className="size-6" />
              </span>
              <div>
                <p className="font-medium">No writing session yet</p>
                <p className="text-muted mt-1 text-sm">
                  Create one to start working with the agent.
                </p>
              </div>
              <Button
                isPending={createMutation.isPending}
                onPress={() => void createSession()}
                size="sm">
                <Plus className="size-4" />
                New chat
              </Button>
            </Card.Content>
          </>
        )}
      </Card>
    </main>
  );
};
