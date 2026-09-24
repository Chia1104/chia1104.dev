"use client";

import { useState } from "react";

import { Alert, Button } from "@heroui/react";
import { CircleAlert } from "lucide-react";

import { ThinkingLevel } from "@chia/agent-runtime/types";
import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import { fill } from "./labels.ts";
import { ModelPicker } from "./model-picker.tsx";
import type { ModelPickerProps } from "./model-picker.tsx";
import {
  useAgentBusy,
  useAgentModels,
  useAgentSession,
  useSessionDetail,
  useUpdateSettings,
} from "./provider.tsx";
import {
  AgentConnection,
  findAgentModel,
  pinnedModelUnavailable,
} from "./store.ts";
import type {
  AgentModel,
  AgentSessionDetail,
  AgentThinkingLevel,
} from "./types.ts";

/** The kind default's catalogue name, or its id when the catalogue has no entry for it. */
const defaultModelNameOf = (
  settings: AgentSessionDetail["settings"],
  models: readonly AgentModel[] | undefined
) =>
  findAgentModel(models, settings?.defaultModel)?.name ??
  settings?.defaultModel.modelId;

export type SessionModelPickerProps = Pick<
  ModelPickerProps,
  | "className"
  | "isOpen"
  | "onOpenChange"
  | "providerIcons"
  | "providerLabels"
  | "providerOrder"
>;

/**
 * Bound to the mounted session. Thinking level is held locally while its write is in flight
 * so the slider does not snap back before the detail refreshes.
 * A session that names no model shows the kind default as the fallback row; choosing that row
 * unpins the session, so an operator's later change to the default reaches it.
 */
export const SessionModelPicker = (props: SessionModelPickerProps) => {
  const settings = useSessionDetail().data?.settings;
  const models = useAgentModels().data;
  const labels = useAgentLabels();
  const updateSettings = useUpdateSettings();
  const busy = useAgentSession(
    (state) => state.connection !== AgentConnection.Idle
  );
  const [draftLevel, setDraftLevel] = useState<AgentThinkingLevel | null>(null);

  const defaultName = defaultModelNameOf(settings, models);

  return (
    <ModelPicker
      {...props}
      fallback={
        defaultName
          ? { label: fill(labels.modelPickerDefault, { model: defaultName }) }
          : undefined
      }
      isDisabled={!settings || busy}
      isPending={updateSettings.isPending}
      models={models}
      onChange={(model) => updateSettings.mutate({ model })}
      onThinkingLevelChange={setDraftLevel}
      onThinkingLevelCommit={(next) => {
        if (next === settings?.thinkingLevel) {
          setDraftLevel(null);
          return;
        }
        setDraftLevel(next);
        updateSettings.mutate(
          { thinkingLevel: next },
          { onSettled: () => setDraftLevel(null) }
        );
      }}
      thinkingLevel={draftLevel ?? settings?.thinkingLevel ?? ThinkingLevel.Off}
      value={
        settings?.modelPinned
          ? { providerId: settings.providerId, modelId: settings.modelId }
          : null
      }
    />
  );
};

/**
 * Warns before the visitor sends into a refused turn and offers the one recovery that needs
 * no key: unpinning the session so it follows the kind default. `useCanPrompt` is false for
 * the same condition, so the composer cannot send meanwhile.
 */
export const SessionModelNotice = ({ className }: { className?: string }) => {
  const labels = useAgentLabels();
  const settings = useSessionDetail().data?.settings;
  const models = useAgentModels().data;
  const updateSettings = useUpdateSettings();
  const busy = useAgentBusy();

  if (!pinnedModelUnavailable(settings, models)) return null;
  const defaultName = defaultModelNameOf(settings, models) ?? "";

  return (
    <Alert
      className={cn("bg-surface-secondary gap-2 px-2.5 py-2", className)}
      status="warning">
      <Alert.Indicator>
        <CircleAlert className="size-4" />
      </Alert.Indicator>
      <Alert.Content className="min-w-0">
        <Alert.Title>{labels.modelUnavailableTitle}</Alert.Title>
        <Alert.Description className="wrap-break-word">
          {fill(labels.modelUnavailableDescription, { model: defaultName })}
        </Alert.Description>
      </Alert.Content>
      <Button
        isDisabled={busy}
        isPending={updateSettings.isPending}
        onPress={() => updateSettings.mutate({ model: null })}
        size="sm"
        variant="secondary">
        {labels.modelUnavailableUseDefault}
      </Button>
    </Alert>
  );
};
