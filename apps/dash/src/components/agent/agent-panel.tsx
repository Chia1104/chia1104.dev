"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CircleAlert, Plus } from "lucide-react";
import { toast } from "sonner";

import { AgentSessionProvider } from "@chia/agent-elements/provider";
import { agentQueryKeys } from "@chia/agent-elements/queries";
import { SessionTabs } from "@chia/agent-elements/session-tabs";
import agentLabels from "@chia/i18n/agent-elements/en-US.json";

import { client, orpc } from "@/libs/orpc/client";

import { WritingSession } from "./writing-session";

const WRITING_AGENT_KIND = "writing";

const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Something went wrong.";

/** The writing sessions and the active one, sized by whatever mounts it (the agent drawer). */
export const AgentPanel = () => {
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

  /**
   * List-level, not the provider's `useUpdateSettings`: the overflow list renames sessions other
   * than the active one, which the provider does not know about.
   */
  const renameMutation = useMutation(
    orpc.agent.sessions["settings:update"].mutationOptions({
      onSuccess: (detail) => {
        queryClient.setQueryData(listOptions.queryKey, (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.id === detail.session.id ? detail.session : item
                ),
              }
            : current
        );
        queryClient.setQueryData(
          agentQueryKeys.session({
            sessionId: detail.session.id,
            kind: WRITING_AGENT_KIND,
          }),
          detail
        );
      },
    })
  );

  const renameSession = useCallback(
    async (sessionId: string, title: string) => {
      try {
        await renameMutation.mutateAsync({
          kind: WRITING_AGENT_KIND,
          sessionId,
          title,
        });
      } catch (error) {
        toast.error(errorMessage(error));
        throw error;
      }
    },
    [renameMutation]
  );

  const deleteMutation = useMutation(
    orpc.agent.sessions.delete.mutationOptions({
      onSuccess: async ({ sessionId }) => {
        // Drop the detail before the list refetches, so nothing tries to rehydrate a deleted
        // session when the active tab moves.
        queryClient.removeQueries({
          queryKey: agentQueryKeys.session({
            sessionId,
            kind: WRITING_AGENT_KIND,
          }),
        });
        if (sessionId === selectedSessionId) {
          const next = sessions.find((session) => session.id !== sessionId);
          const params = new URLSearchParams(searchParams.toString());
          if (next) params.set("session", next.id);
          else params.delete("session");
          const query = params.toString();
          router.replace(query ? `${pathname}?${query}` : pathname);
        }
        await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
      },
    })
  );

  const deleteSession = useCallback(
    async (sessionId: string) => {
      try {
        await deleteMutation.mutateAsync({
          kind: WRITING_AGENT_KIND,
          sessionId,
        });
      } catch (error) {
        toast.error(errorMessage(error));
        throw error;
      }
    },
    [deleteMutation]
  );

  const tabs = (
    <SessionTabs
      activeId={selectedSessionId}
      className="min-w-0 flex-1"
      isCreating={createMutation.isPending}
      labels={agentLabels}
      onCreate={() => void createSession()}
      onDelete={deleteSession}
      onRename={renameSession}
      onSelect={selectSession}
      sessions={sessions}
    />
  );

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner aria-label="Loading writing sessions" size="sm" />
      </div>
    );
  }
  if (sessionsQuery.isError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <CircleAlert className="text-danger size-6" />
        <p>Unable to load sessions.</p>
        <Button
          onPress={() => void sessionsQuery.refetch()}
          size="sm"
          variant="secondary">
          Try again
        </Button>
      </div>
    );
  }
  if (selectedSessionId) {
    return (
      <AgentSessionProvider
        key={selectedSessionId}
        client={client.agent}
        kind={WRITING_AGENT_KIND}
        labels={agentLabels}
        onForked={(detail) => {
          // The fork is where the operator wants to continue; its detail is already cached.
          selectSession(detail.session.id);
          invalidateSessions();
        }}
        onTurnEnd={invalidateSessions}
        sessionId={selectedSessionId}>
        <WritingSession tabs={tabs} />
      </AgentSessionProvider>
    );
  }
  return (
    <>
      <div className="flex min-w-0 items-center gap-3 px-4 py-3">{tabs}</div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
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
      </div>
    </>
  );
};
