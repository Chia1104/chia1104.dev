"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button, Spinner } from "@heroui/react";
import { ORPCError } from "@orpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";

import { Composer } from "@chia/agent-elements/composer";
import { EmptyState } from "@chia/agent-elements/empty-state";
import { AgentSessionProvider } from "@chia/agent-elements/provider";
import { agentQueryKeys } from "@chia/agent-elements/queries";
import { contentToolRenderers } from "@chia/agent-elements/renderers/content";
import { SessionModelPicker } from "@chia/agent-elements/session-model-picker";
import { SessionTabs } from "@chia/agent-elements/session-tabs";
import { Thread } from "@chia/agent-elements/thread";
import enUS from "@chia/i18n/agent-elements/en-US.json";
import zhTW from "@chia/i18n/agent-elements/zh-TW.json";

import { client, orpc } from "@/libs/orpc/client";
import { Locale } from "@/libs/utils/i18n";
import { useSettingsStore } from "@/stores/settings/store";

import { AccountMenu } from "./account-menu";
import { ApiKeyDialog } from "./api-key-dialog";
import { ComingSoon } from "./coming-soon";
import { HumanCheck } from "./human-check";
import { PUBLIC_AGENT_KIND } from "./kind";
import { UsageMeter } from "./usage-meter";
import { useChatSession } from "./use-chat-session";
import type { ChatUser } from "./use-chat-session";

/** House first: no setup. BYOK providers follow once the visitor registers a key. */
const PROVIDER_ORDER = ["vercel-ai-gateway", "openai", "anthropic"];

const agentLabelsOf = (locale: string) => (locale === Locale.EN ? enUS : zhTW);

/** A signed-in visitor the kind's `minTier` still refuses: the public agent is not open yet. */
const isGated = (error: Error | null): boolean =>
  error instanceof ORPCError && error.code === "FORBIDDEN";

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
    {children}
  </div>
);

export const PublicChat = () => {
  const t = useTranslations("chbot");
  const session = useChatSession();

  if (session.isError) {
    return (
      <Centered>
        <p className="text-muted text-sm">{t("loadFailed")}</p>
        <Button
          onPress={() => void session.refetch()}
          size="sm"
          variant="secondary">
          {t("retry")}
        </Button>
      </Centered>
    );
  }

  if (session.data === undefined) {
    return (
      <Centered>
        <Spinner aria-label={t("signingIn")} size="sm" />
      </Centered>
    );
  }

  if (session.data === null) {
    return <HumanCheck />;
  }

  return <PublicChatSessions user={session.data} />;
};

const PublicChatSessions = ({ user }: { user: ChatUser }) => {
  const t = useTranslations("chbot");
  const locale = useLocale();
  const labels = agentLabelsOf(locale);
  const queryClient = useQueryClient();

  const listOptions = orpc.agent.sessions.list.queryOptions({
    input: { kind: PUBLIC_AGENT_KIND, limit: 20 },
  });
  const sessionsQuery = useQuery(listOptions);
  const sessions = sessionsQuery.data?.items ?? [];

  const storedSessionId = useSettingsStore((state) => state.agentSessionId);
  const setStoredSessionId = useSettingsStore(
    (state) => state.setAgentSessionId
  );
  const selectedSessionId = sessions.some(
    (session) => session.id === storedSessionId
  )
    ? storedSessionId
    : (sessions.at(0)?.id ?? null);

  const invalidateSessions = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
  }, [listOptions.queryKey, queryClient]);

  // Titles arrive with the first reply and spend moves only when a turn ends.
  const onTurnEnd = useCallback(() => {
    invalidateSessions();
    void queryClient.invalidateQueries({ queryKey: agentQueryKeys.usage() });
  }, [invalidateSessions, queryClient]);

  const createMutation = useMutation(
    orpc.agent.sessions.create.mutationOptions({
      onSuccess: async (detail) => {
        setStoredSessionId(detail.session.id);
        await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
      },
    })
  );

  // A visitor's first open gets a conversation, so the composer has somewhere to send. The ref
  // keeps StrictMode's doubled effect from creating two.
  const creating = useRef(false);
  useEffect(() => {
    if (!sessionsQuery.isSuccess || sessions.length > 0 || creating.current) {
      return;
    }
    creating.current = true;
    createMutation.mutate(
      { kind: PUBLIC_AGENT_KIND },
      {
        onSettled: () => {
          creating.current = false;
        },
      }
    );
  }, [createMutation, sessions.length, sessionsQuery.isSuccess]);

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
            kind: PUBLIC_AGENT_KIND,
          }),
          detail
        );
      },
    })
  );

  const deleteMutation = useMutation(
    orpc.agent.sessions.delete.mutationOptions({
      onSuccess: async ({ sessionId }) => {
        queryClient.removeQueries({
          queryKey: agentQueryKeys.session({
            sessionId,
            kind: PUBLIC_AGENT_KIND,
          }),
        });
        if (sessionId === storedSessionId) {
          setStoredSessionId(null);
        }
        await queryClient.invalidateQueries({ queryKey: listOptions.queryKey });
      },
    })
  );

  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const localCommands = useMemo(
    () => [
      {
        name: "model",
        description: labels.switchModel,
        onSelect: () => setModelPickerOpen(true),
      },
    ],
    [labels.switchModel]
  );

  const suggestions = [
    t("suggestions.latest"),
    t("suggestions.topics"),
    t("suggestions.find"),
  ];

  const failed = sessionsQuery.isError || createMutation.isError;
  const retry = () => {
    if (sessionsQuery.isError) void sessionsQuery.refetch();
    else createMutation.mutate({ kind: PUBLIC_AGENT_KIND });
  };

  if (isGated(sessionsQuery.error) || isGated(createMutation.error)) {
    return <ComingSoon />;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex min-w-0 items-center gap-3 px-4 py-2">
        <SessionTabs
          activeId={selectedSessionId}
          className="min-w-0 flex-1"
          isCreating={createMutation.isPending}
          labels={labels}
          onCreate={() => createMutation.mutate({ kind: PUBLIC_AGENT_KIND })}
          onDelete={async (sessionId) => {
            await deleteMutation.mutateAsync({
              kind: PUBLIC_AGENT_KIND,
              sessionId,
            });
          }}
          onRename={async (sessionId, title) => {
            await renameMutation.mutateAsync({
              kind: PUBLIC_AGENT_KIND,
              sessionId,
              title,
            });
          }}
          onSelect={setStoredSessionId}
          sessions={sessions}
          visible={2}
        />
        <AccountMenu user={user} />
      </div>
      {selectedSessionId ? (
        <AgentSessionProvider
          key={selectedSessionId}
          client={client.agent}
          kind={PUBLIC_AGENT_KIND}
          labels={labels}
          onForked={(detail) => {
            setStoredSessionId(detail.session.id);
            invalidateSessions();
          }}
          onTurnEnd={onTurnEnd}
          sessionId={selectedSessionId}>
          <Thread
            className="px-4"
            empty={
              <EmptyState
                description={t("emptyDescription")}
                suggestions={suggestions}
                title={t("emptyTitle")}
              />
            }
            renderers={contentToolRenderers}
          />
          <Composer
            localCommands={localCommands}
            placeholder={t("placeholder")}
            toolbar={
              <>
                <SessionModelPicker
                  isOpen={modelPickerOpen}
                  onOpenChange={setModelPickerOpen}
                  providerOrder={PROVIDER_ORDER}
                />
                <ApiKeyDialog />
                <UsageMeter />
              </>
            }
          />
        </AgentSessionProvider>
      ) : failed ? (
        <Centered>
          <p className="text-muted text-sm">{t("loadFailed")}</p>
          <Button onPress={retry} size="sm" variant="secondary">
            {t("retry")}
          </Button>
        </Centered>
      ) : (
        <Centered>
          <Spinner aria-label={t("signingIn")} size="sm" />
        </Centered>
      )}
    </div>
  );
};
