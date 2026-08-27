"use client";

import { useCallback } from "react";

import { Chip, ListBox, Select } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import * as z from "zod";

import { providerLabelOf } from "@chia/agent-elements/provider-icons";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

/**
 * Pieces both the kind and the task cards share: the model select with its "code default"
 * row, the override chip, and the invalidation every write ends with.
 */

export type AgentModelInfo =
  RouterOutputs["agent"]["admin"]["tasks"]["models"][number];
/** Mirrors the contract's `agentModelRefSchema`; the form schemas compose it. */
export const modelRefSchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
});

export type ModelRef = z.infer<typeof modelRefSchema>;

/** The select's id for "no override"; a real pair always has a space in the middle. */
export const DEFAULT_OPTION = "__default__";

export const keyOf = (ref: ModelRef) => `${ref.providerId} ${ref.modelId}`;

export const refOf = (key: string): ModelRef | null => {
  if (key === DEFAULT_OPTION) return null;
  const index = key.indexOf(" ");
  if (index < 0) return null;
  return { providerId: key.slice(0, index), modelId: key.slice(index + 1) };
};

export const modelLabel = (
  ref: ModelRef,
  models?: readonly AgentModelInfo[]
) => {
  const known = models?.find(
    (m) => m.providerId === ref.providerId && m.modelId === ref.modelId
  );
  const provider = providerLabelOf(ref.providerId) ?? ref.providerId;
  return `${known?.name ?? ref.modelId} · ${provider}`;
};

export interface ModelSelectProps {
  label: string;
  /** What "Default" resolves to; shown in the row so the choice is never blind. */
  defaultLabel: string;
  models: readonly AgentModelInfo[] | undefined;
  value: ModelRef | null;
  onChange: (ref: ModelRef | null) => void;
  isDisabled?: boolean;
}

/**
 * A model pair or the code default. Models a caller-supplied key would be needed for are
 * listed but disabled: the operator can see the option exists and why it is not available.
 */
export const ModelSelect = ({
  defaultLabel,
  isDisabled,
  label,
  models,
  onChange,
  value,
}: ModelSelectProps) => {
  const items = [
    { id: DEFAULT_OPTION, label: `Default — ${defaultLabel}`, disabled: false },
    ...(models ?? []).map((model) => ({
      id: keyOf(model),
      label: modelLabel(model, models),
      disabled: model.requiresApiKey,
    })),
  ];
  const disabledKeys = items.filter((i) => i.disabled).map((i) => i.id);
  return (
    <Select
      aria-label={label}
      className="w-full"
      isDisabled={isDisabled}
      onChange={(key) => onChange(refOf(String(key)))}
      value={value ? keyOf(value) : DEFAULT_OPTION}>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox disabledKeys={disabledKeys} items={items}>
          {(item) => (
            <ListBox.Item id={item.id} textValue={item.label}>
              {item.label}
            </ListBox.Item>
          )}
        </ListBox>
      </Select.Popover>
    </Select>
  );
};

export const OverriddenChip = ({ isOverridden }: { isOverridden: boolean }) =>
  isOverridden ? (
    <Chip color="warning" size="sm" variant="soft">
      <Chip.Label className="text-xs">overridden</Chip.Label>
    </Chip>
  ) : (
    <Chip size="sm" variant="soft">
      <Chip.Label className="text-xs">code default</Chip.Label>
    </Chip>
  );

export const formatDate = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export const useInvalidateAgentAdmin = () => {
  const queryClient = useQueryClient();
  return useCallback(
    () =>
      void queryClient.invalidateQueries({ queryKey: orpc.agent.admin.key() }),
    [queryClient]
  );
};
