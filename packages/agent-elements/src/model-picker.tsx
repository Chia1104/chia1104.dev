"use client";

import { useEffect, useMemo, useState } from "react";

import { Button, ListBox, Popover, SearchField, Tooltip } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { ProviderMark, providerLabelOf, vendorOf } from "./provider-icons.tsx";
import type { ProviderIcon } from "./provider-icons.tsx";
import { useAgentLabels, useAgentSession } from "./provider.tsx";
import { ThinkingSlider } from "./thinking-slider.tsx";
import type { AgentModel, AgentThinkingLevel } from "./types.ts";

/**
 * A model is identified by its `(providerId, modelId)` pair — the same model carries different
 * ids under different providers, so neither half alone is a key.
 */
const keyOf = (model: { providerId: string; modelId: string }) =>
  `${model.providerId} ${model.modelId}`;

export interface ModelPickerProps {
  /** Display names per provider or vendor id, on top of the built-in ones. */
  providerLabels?: Readonly<Record<string, string>>;
  /** Marks per provider or vendor id, on top of the built-in ones. */
  providerIcons?: Readonly<Record<string, ProviderIcon>>;
  /** Providers in the order offered; the rest follow alphabetically. */
  providerOrder?: readonly string[];
  className?: string;
}

/**
 * One popover: a rail of provider marks, a searchable model list for the active provider, and
 * the thinking slider. Choosing anything persists it on the session straight away; the trigger
 * reflects the session's current settings with the model vendor's mark.
 */
export const ModelPicker = ({
  className,
  providerIcons,
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
  const [query, setQuery] = useState("");
  const [rail, setRail] = useState<string | null>(null);
  // Slider position while dragging; the session value takes over once the drag commits.
  const [draftLevel, setDraftLevel] = useState<AgentThinkingLevel | null>(null);

  const nameOf = (id: string) =>
    providerLabels?.[id] ?? providerLabelOf(id) ?? id;

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
        models: list.toSorted((a, b) => a.name.localeCompare(b.name)),
      }));
  }, [models, providerOrder]);

  const activeProvider =
    providers.find(
      (provider) => provider.id === (rail ?? settings?.providerId)
    ) ?? providers[0];

  const visibleModels = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const list = activeProvider?.models ?? [];
    return needle
      ? list.filter(
          (model) =>
            model.name.toLowerCase().includes(needle) ||
            model.modelId.toLowerCase().includes(needle)
        )
      : list;
  }, [activeProvider, query]);

  const current = settings
    ? (models ?? []).find((model) => keyOf(model) === keyOf(settings))
    : undefined;
  const supportsReasoning = current?.supportsReasoning ?? true;
  const level = draftLevel ?? settings?.thinkingLevel ?? "off";

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

  const triggerVendor = settings ? vendorOf(settings) : null;
  const triggerModel = current?.name ?? settings?.modelId ?? labels.modelPicker;

  return (
    <Popover
      isOpen={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}>
      <Popover.Trigger>
        <Button
          aria-label={labels.modelPicker}
          className={cn("h-8 gap-1.5 px-2 text-xs", className)}
          isDisabled={!settings || busy || saving}
          isPending={saving}
          size="sm"
          variant="ghost">
          {triggerVendor ? (
            <ProviderMark
              className="size-3.5"
              icons={providerIcons}
              id={triggerVendor}
            />
          ) : null}
          <span className="max-w-40 truncate font-medium">{triggerModel}</span>
          {settings && supportsReasoning ? (
            <>
              <span className="bg-separator mx-0.5 h-3 w-px" />
              <span className="text-muted">
                {labels.thinkingLevelNames[level]}
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

      <Popover.Content className="w-[26rem] p-0" placement="top start">
        <Popover.Dialog className="flex flex-col p-0">
          <div className="flex min-h-0">
            <div className="border-border flex w-12 shrink-0 flex-col items-center gap-1 border-r py-2">
              {providers.map((provider) => {
                const active = provider.id === activeProvider?.id;
                return (
                  <Tooltip key={provider.id} delay={300}>
                    <Tooltip.Trigger>
                      <Button
                        aria-label={nameOf(provider.id)}
                        aria-pressed={active}
                        className={cn(
                          "relative size-9",
                          active
                            ? "bg-surface-secondary text-foreground "
                            : "text-muted"
                        )}
                        isIconOnly
                        onPress={() => setRail(provider.id)}
                        size="sm"
                        variant="ghost">
                        <ProviderMark
                          className="size-[18px]"
                          icons={providerIcons}
                          id={provider.id}
                        />
                      </Button>
                    </Tooltip.Trigger>
                    <Tooltip.Content placement="right">
                      {nameOf(provider.id)}
                    </Tooltip.Content>
                  </Tooltip>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="p-2 pb-1">
                <SearchField
                  aria-label={labels.searchModels}
                  fullWidth
                  onChange={setQuery}
                  value={query}>
                  <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={labels.searchModels} />
                    <SearchField.ClearButton />
                  </SearchField.Group>
                </SearchField>
              </div>
              <ListBox
                aria-label={labels.modelPicker}
                // Focuses the selected model on open, which also scrolls it into view.
                autoFocus
                className="max-h-64 overflow-y-auto px-1.5 pb-1.5"
                disallowEmptySelection
                onSelectionChange={(keys) => {
                  const key = [...keys][0];
                  const next = (models ?? []).find(
                    (model) => keyOf(model) === key
                  );
                  if (!next || (settings && keyOf(next) === keyOf(settings))) {
                    return;
                  }
                  void save({
                    model: {
                      providerId: next.providerId,
                      modelId: next.modelId,
                    },
                  });
                }}
                renderEmptyState={() => (
                  <p className="text-muted px-3 py-6 text-center text-xs">
                    {labels.noModels}
                  </p>
                )}
                selectedKeys={
                  settings ? new Set([keyOf(settings)]) : new Set<string>()
                }
                selectionMode="single">
                {visibleModels.map((model) => {
                  const vendor = vendorOf(model);
                  return (
                    <ListBox.Item
                      key={keyOf(model)}
                      className="py-2"
                      id={keyOf(model)}
                      isDisabled={model.requiresApiKey}
                      textValue={model.name}>
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate">{model.name}</span>
                        <span className="text-muted flex items-center gap-1.5 text-xs">
                          <ProviderMark
                            className="size-3"
                            icons={providerIcons}
                            id={vendor}
                          />
                          {nameOf(vendor)}
                          {model.requiresApiKey
                            ? ` · ${labels.needsApiKey}`
                            : ""}
                        </span>
                      </span>
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  );
                })}
              </ListBox>
            </div>
          </div>

          {supportsReasoning ? (
            <div className="border-border border-t px-4 py-3">
              <ThinkingSlider
                isDisabled={saving}
                onChange={setDraftLevel}
                onCommit={(next) => {
                  setDraftLevel(null);
                  if (next !== settings?.thinkingLevel) {
                    void save({ thinkingLevel: next });
                  }
                }}
                value={level}
              />
            </div>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
