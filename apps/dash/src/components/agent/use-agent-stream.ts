"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AgentWireEvent } from "@chia/agent-core";

import { client } from "@/libs/orpc/client";

interface StartAgentStreamOptions {
  sessionId: string;
  runId?: string;
  startIndex?: number;
}

interface UseAgentStreamOptions {
  onEvent: (event: AgentWireEvent) => void;
  onError: (error: unknown) => void;
  onClose?: () => void;
}

type AgentEventIterator = Awaited<
  ReturnType<typeof client.agent.sessions.stream>
>;

interface ActiveAgentStream {
  key: string;
  iterator: AgentEventIterator;
}

export const consumeAgentStream = async (
  iterator: AsyncIterable<AgentWireEvent>,
  onEvent: (event: AgentWireEvent) => void
) => {
  for await (const event of iterator) onEvent(event);
};

export const useAgentStream = ({
  onEvent,
  onError,
  onClose,
}: UseAgentStreamOptions) => {
  const callbacksRef = useRef({ onEvent, onError, onClose });
  callbacksRef.current = { onEvent, onError, onClose };

  const activeRef = useRef<ActiveAgentStream | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const close = useCallback(async () => {
    const active = activeRef.current;
    activeRef.current = null;
    setIsConnected(false);
    await active?.iterator.return?.();
  }, []);

  const start = useCallback(
    async ({ sessionId, runId, startIndex }: StartAgentStreamOptions) => {
      const key = runId ?? `session:${sessionId}`;
      if (activeRef.current?.key === key) return;

      await close();

      try {
        const iterator = await client.agent.sessions.stream({
          sessionId,
          runId,
          startIndex,
          deltas: true,
        });
        const active = { key, iterator };
        activeRef.current = active;
        setIsConnected(true);

        void consumeAgentStream(iterator, (event) => {
          if (activeRef.current === active) callbacksRef.current.onEvent(event);
        })
          .catch((error: unknown) => {
            if (activeRef.current === active) {
              callbacksRef.current.onError(error);
            }
          })
          .finally(() => {
            if (activeRef.current !== active) return;
            activeRef.current = null;
            setIsConnected(false);
            callbacksRef.current.onClose?.();
          });
      } catch (error) {
        callbacksRef.current.onError(error);
      }
    },
    [close]
  );

  useEffect(
    () => () => {
      const active = activeRef.current;
      activeRef.current = null;
      void active?.iterator.return?.();
    },
    []
  );

  return { close, isConnected, start };
};
