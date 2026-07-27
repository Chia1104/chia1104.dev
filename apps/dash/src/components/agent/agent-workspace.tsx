"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button, Card, ScrollShadow, Spinner } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CircleAlert, Plus } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";

import { AgentSession } from "./agent-session";

const WRITING_AGENT_KIND = "writing";
const updatedAtFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

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

  return (
    <main className="flex min-h-[calc(100svh-4rem)] flex-1 flex-col gap-4 p-4 lg:overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted text-sm">Agents</p>
          <h1 className="text-2xl font-semibold">Writing Agent</h1>
        </div>
        <Button
          isPending={createMutation.isPending}
          onPress={() => void createSession()}
          size="sm">
          <Plus className="size-4" />
          New session
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Card className="min-h-0 gap-0 overflow-hidden p-0">
          <Card.Header className="border-border border-b px-4 py-3">
            <Card.Title className="text-sm">Sessions</Card.Title>
            <Card.Description>
              {sessions.length} writing conversation
              {sessions.length === 1 ? "" : "s"}
            </Card.Description>
          </Card.Header>
          <Card.Content className="min-h-0 flex-1 p-0">
            {sessionsQuery.isLoading ? (
              <div className="flex min-h-32 items-center justify-center">
                <Spinner aria-label="Loading writing sessions" size="sm" />
              </div>
            ) : sessionsQuery.isError ? (
              <div className="text-muted flex min-h-32 flex-col items-center justify-center gap-3 p-4 text-center text-sm">
                <CircleAlert className="text-danger size-5" />
                <p>Unable to load sessions.</p>
                <Button
                  onPress={() => void sessionsQuery.refetch()}
                  size="sm"
                  variant="secondary">
                  Try again
                </Button>
              </div>
            ) : sessions.length === 0 ? (
              <div className="text-muted flex min-h-40 flex-col items-center justify-center gap-3 p-4 text-center text-sm">
                <Bot className="size-6" />
                <p>Create a session to start drafting.</p>
              </div>
            ) : (
              <ScrollShadow className="max-h-60 p-2 lg:h-full lg:max-h-none">
                <div className="flex flex-col gap-1">
                  {sessions.map((session) => (
                    <Button
                      key={session.id}
                      className="h-auto justify-start px-3 py-2 text-left"
                      fullWidth
                      onPress={() => selectSession(session.id)}
                      variant={
                        selectedSessionId === session.id ? "tertiary" : "ghost"
                      }>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {session.title || "Untitled session"}
                        </span>
                        <span className="text-muted block truncate text-xs">
                          {updatedAtFormatter.format(session.updatedAt)}
                        </span>
                      </span>
                    </Button>
                  ))}
                </div>
              </ScrollShadow>
            )}
          </Card.Content>
        </Card>

        {selectedSessionId ? (
          <AgentSession
            key={selectedSessionId}
            onSessionChanged={invalidateSessions}
            sessionId={selectedSessionId}
          />
        ) : (
          <Card className="flex min-h-96 items-center justify-center text-center">
            <Card.Content className="items-center gap-3">
              <span className="bg-surface-secondary flex size-12 items-center justify-center rounded-full">
                <Bot className="size-6" />
              </span>
              <div>
                <p className="font-medium">No writing session yet</p>
                <p className="text-muted mt-1 text-sm">
                  Create one to start working with the agent.
                </p>
              </div>
              <Button onPress={() => void createSession()} size="sm">
                <Plus className="size-4" />
                New session
              </Button>
            </Card.Content>
          </Card>
        )}
      </div>
    </main>
  );
};
