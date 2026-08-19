"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, ListBox, Popover, Separator, Tabs } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels, useAgentSession } from "./provider.tsx";
import type { AgentModel, AgentThinkingLevel } from "./types.ts";

const THINKING_LEVELS: readonly AgentThinkingLevel[] = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

/**
 * A model is identified by its `(providerId, modelId)` pair — the same model carries different
 * ids under different providers, so neither half alone is a key.
 */
const keyOf = (model: { providerId: string; modelId: string }) =>
  `${model.providerId} ${model.modelId}`;

export interface ModelPickerProps {
  /** Display names per provider id; anything missing shows its raw id. */
  providerLabels?: Readonly<Record<string, string>>;
  /** Providers in the order offered; the rest follow alphabetically. */
  providerOrder?: readonly string[];
  className?: string;
}

/**
 * Provider tabs → model list → thinking level, in one popover. Choosing anything persists it on
 * the session straight away; the trigger reflects the session's current settings.
 */
export const ModelPicker = ({
  className,
  providerLabels,
  providerOrder = [],
}: ModelPickerProps) => {
  const labels = useAgentLabels();
  const settings = useAgentSession((state) => state.detail?.settings);
  const models = useAgentSession((state) => state.models);
  const loadModels = useAgentSession((state) => state.loadModels);
  const updateSettings = useAgentSession((state) => state.updateSettings);
  const busy = useAgentSession((state) => state.connection !== "idle");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Loaded up front so the trigger can show the model's display name, not its raw id.
  const ready = settings !== undefined;
  useEffect(() => {
    if (ready) void loadModels();
  }, [loadModels, ready]);

  const providers = useMemo(() => {
    const groups = new Map<string, AgentModel[]>();
    for (const model of models ?? []) {
      const list = groups.get(model.providerId) ?? [];
      list.push(model);
      groups.set(model.providerId, list);
    }
    const rank = (id: string) => {
      const index = providerOrder.indexOf(id);
      return index === -1 ? providerOrder.length : index;
    };
    return [...groups.entries()]
      .sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
      .map(([id, list]) => ({
        id,
        label: providerLabels?.[id] ?? id,
        models: list.toSorted((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [models, providerLabels, providerOrder]);

  const [tab, setTab] = useState<string | null>(null);
  const activeProvider =
    providers.find(
      (provider) => provider.id === (tab ?? settings?.providerId)
    ) ?? providers[0];

  const current = settings
    ? (models ?? []).find(
        (model) =>
          model.providerId === settings.providerId &&
          model.modelId === settings.modelId
      )
    : undefined;
  const supportsReasoning = current?.supportsReasoning ?? true;

  const save = async (input: Parameters<typeof updateSettings>[0]) => {
    setSaving(true);
    try {
      await updateSettings(input);
    } catch {
      // Recorded in `failure`.
    } finally {
      setSaving(false);
    }
  };

  const triggerModel = current?.name ?? settings?.modelId ?? labels.modelPicker;
  const triggerProvider = settings
    ? (providerLabels?.[settings.providerId] ?? settings.providerId)
    : null;

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          aria-label={labels.modelPicker}
          className={cn("h-8 gap-2 px-2.5 text-xs", className)}
          isDisabled={!settings || busy || saving}
          isPending={saving}
          size="sm"
          variant="secondary">
          {triggerProvider ? (
            <span className="text-muted">{triggerProvider}</span>
          ) : null}
          <span className="max-w-40 truncate">{triggerModel}</span>
          {settings && supportsReasoning ? (
            <>
              <span className="bg-separator h-3 w-px" />
              <span className="text-muted">
                {labels.thinkingLevelNames[settings.thinkingLevel]}
              </span>
            </>
          ) : null}
          <ChevronDown
            className={cn(
              "text-muted size-3.5 transition-transform",
              open && "rotate-180"
            )}
          />
        </Button>
      </Popover.Trigger>
      <Popover.Content className="w-80 p-0" placement="bottom end">
        <Popover.Dialog className="flex flex-col gap-1 p-1.5">
          {providers.length > 1 ? (
            <Tabs
              onSelectionChange={(key) => setTab(String(key))}
              selectedKey={activeProvider?.id}
              variant="secondary">
              <Tabs.ListContainer>
                <Tabs.List aria-label={labels.modelPicker} className="w-full">
                  {providers.map((provider) => (
                    <Tabs.Tab
                      key={provider.id}
                      className="flex-1"
                      id={provider.id}>
                      {provider.label}
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  ))}
                </Tabs.List>
              </Tabs.ListContainer>
            </Tabs>
          ) : null}

          <ListBox
            aria-label={labels.modelPicker}
            // Focuses the selected model on open, which also scrolls it into view.
            autoFocus
            className="max-h-72 overflow-y-auto"
            disallowEmptySelection
            onSelectionChange={(keys) => {
              const key = [...keys][0];
              const next = (models ?? []).find((model) => keyOf(model) === key);
              if (!next || (settings && keyOf(next) === keyOf(settings)))
                return;
              void save({
                model: { providerId: next.providerId, modelId: next.modelId },
              });
            }}
            selectedKeys={
              settings ? new Set([keyOf(settings)]) : new Set<string>()
            }
            selectionMode="single">
            {(activeProvider?.models ?? []).map((model) => (
              <ListBox.Item
                key={keyOf(model)}
                id={keyOf(model)}
                isDisabled={model.requiresApiKey}
                textValue={model.name}>
                <span className="flex-1 truncate">{model.name}</span>
                {model.requiresApiKey ? (
                  <span className="text-muted text-xs">
                    {labels.needsApiKey}
                  </span>
                ) : null}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>

          {supportsReasoning ? (
            <>
              <Separator className="my-0.5" />
              <span className="text-muted px-2 pt-1 text-[11px] tracking-wide uppercase">
                {labels.thinkingLevel}
              </span>
              <ListBox
                aria-label={labels.thinkingLevel}
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const key = [...keys][0];
                  const level = THINKING_LEVELS.find(
                    (candidate) => candidate === key
                  );
                  if (!level || level === settings?.thinkingLevel) return;
                  void save({ thinkingLevel: level });
                }}
                selectedKeys={
                  settings
                    ? new Set([settings.thinkingLevel])
                    : new Set<string>()
                }
                selectionMode="single">
                {THINKING_LEVELS.map((level) => (
                  <ListBox.Item
                    key={level}
                    id={level}
                    textValue={labels.thinkingLevelNames[level]}>
                    <span className="flex-1">
                      {labels.thinkingLevelNames[level]}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
