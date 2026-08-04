"use client";

import { useCallback, useMemo } from "react";

import { ListBox, Select } from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type AgentModel = RouterOutputs["agent"]["models"]["list"][number];

interface AgentModelPickerProps {
  sessionId: string;
  kind: string;
  providerId?: string;
  modelId?: string;
  onChanged: () => void;
}

/**
 * Providers, in the order they are offered.
 *
 * The gateway leads because it is the house account and needs no setup; the bring-your-own-key
 * providers follow. Anything the server adds later still renders — it just sorts last under its
 * raw id rather than a friendly label.
 */
const PROVIDER_ORDER = ["vercel-ai-gateway", "openai", "anthropic"] as const;

const PROVIDER_LABELS: Record<string, string> = {
  "vercel-ai-gateway": "Gateway",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

const providerLabel = (providerId: string) =>
  PROVIDER_LABELS[providerId] ?? providerId;

/**
 * The picker's key.
 *
 * A model is identified by its `(providerId, modelId)` pair, never the id alone — the same model
 * carries different ids under different providers (`anthropic/claude-haiku-4.5` on the gateway is
 * `claude-haiku-4-5` natively), and two entries would otherwise collide on one key.
 */
const keyOf = (model: { providerId: string; modelId: string }) =>
  `${model.providerId}:${model.modelId}`;

const parseKey = (key: string) => {
  const [providerId, modelId] = key.split(":");
  return providerId && modelId ? { providerId, modelId } : null;
};

const rank = (providerId: string) => {
  const index = PROVIDER_ORDER.indexOf(
    providerId as (typeof PROVIDER_ORDER)[number]
  );
  return index === -1 ? PROVIDER_ORDER.length : index;
};

const sortModels = (models: AgentModel[]) =>
  [...models].sort(
    (a, b) =>
      rank(a.providerId) - rank(b.providerId) ||
      a.providerId.localeCompare(b.providerId) ||
      a.name.localeCompare(b.name)
  );

export const AgentModelPicker = ({
  kind,
  modelId,
  onChanged,
  providerId,
  sessionId,
}: AgentModelPickerProps) => {
  const queryClient = useQueryClient();
  const { data } = useQuery(
    orpc.agent.models.list.queryOptions({ input: { kind } })
  );
  const update = useMutation(
    orpc.agent.sessions["settings:update"].mutationOptions()
  );

  const models = useMemo(() => sortModels(data ?? []), [data]);

  const select = useCallback(
    async (key: string | null) => {
      const next = key ? parseKey(key) : null;
      if (!next) return;
      if (next.providerId === providerId && next.modelId === modelId) return;

      try {
        await update.mutateAsync({ sessionId, model: next });
        await queryClient.invalidateQueries({
          queryKey: orpc.agent.sessions.get.queryKey({ input: { sessionId } }),
        });
        onChanged();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not switch model."
        );
      }
    },
    [modelId, onChanged, providerId, queryClient, sessionId, update]
  );

  const selectedKey =
    providerId && modelId ? keyOf({ providerId, modelId }) : undefined;

  return (
    <Select
      aria-label="Agent model"
      isDisabled={update.isPending || models.length === 0}
      onChange={(key) => void select(key as string | null)}
      placeholder="Select a model"
      value={selectedKey}>
      <Select.Trigger className="min-w-56">
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {models.map((model) => (
            <ListBox.Item
              /**
               * A model on an unconfigured bring-your-own-key provider is shown but not
               * selectable — hiding it would leave the operator with no way to discover that
               * registering a key unlocks it.
               */
              isDisabled={model.requiresApiKey}
              id={keyOf(model)}
              key={keyOf(model)}
              textValue={`${providerLabel(model.providerId)} · ${model.name}`}>
              {providerLabel(model.providerId)} · {model.name}
              {model.requiresApiKey ? " · needs API key" : ""}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};
