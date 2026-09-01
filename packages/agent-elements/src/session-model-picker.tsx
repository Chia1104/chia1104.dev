"use client";

import { useState } from "react";

import { ModelPicker } from "./model-picker.tsx";
import type { ModelPickerProps } from "./model-picker.tsx";
import {
  useAgentModels,
  useAgentSession,
  useSessionDetail,
  useUpdateSettings,
} from "./provider.tsx";
import type { AgentThinkingLevel } from "./types.ts";

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
 */
export const SessionModelPicker = (props: SessionModelPickerProps) => {
  const settings = useSessionDetail().data?.settings;
  const models = useAgentModels().data;
  const updateSettings = useUpdateSettings();
  const busy = useAgentSession((state) => state.connection !== "idle");
  const [draftLevel, setDraftLevel] = useState<AgentThinkingLevel | null>(null);

  return (
    <ModelPicker
      {...props}
      isDisabled={!settings || busy}
      isPending={updateSettings.isPending}
      models={models}
      onChange={(model) => {
        if (model) updateSettings.mutate({ model });
      }}
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
      thinkingLevel={draftLevel ?? settings?.thinkingLevel ?? "off"}
      value={
        settings
          ? { providerId: settings.providerId, modelId: settings.modelId }
          : null
      }
    />
  );
};
