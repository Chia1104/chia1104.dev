"use client";

import { useMemo, useState } from "react";

import { Button, ListBox, Popover, SearchField, Tooltip } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

import { useAgentLabels } from "./labels-context.tsx";
import { ProviderMark, providerLabelOf, vendorOf } from "./provider-icons.tsx";
import type { ProviderIcon } from "./provider-icons.tsx";
import { ThinkingSlider } from "./thinking-slider.tsx";
import type { AgentModel, AgentModelRef, AgentThinkingLevel } from "./types.ts";

/**
 * A model is identified by its `(providerId, modelId)` pair. The same model carries different
 * ids under different providers, so neither half alone is a key.
 */
const keyOf = (model: AgentModelRef) => `${model.providerId} ${model.modelId}`;

/** The list row that stands for "no choice"; never a provider id, so it cannot collide. */
const FALLBACK_KEY = "";

export interface ModelPickerProps {
  models: readonly AgentModel[] | undefined;
  /** The selected pair, or `null` when {@link ModelPickerProps.fallback} is what applies. */
  value: AgentModelRef | null;
  /** `null` only when the fallback row was chosen. */
  onChange: (model: AgentModelRef | null) => void;
  /**
   * A row above the catalogue for "no choice" (a code default, an inherited setting). Choosing
   * it yields `null`; its label is what the trigger shows for `null`.
   */
  fallback?: { label: string };
  /**
   * Omitted (and the slider hidden) when unset or the selected model has no reasoning to
   * configure.
   */
  thinkingLevel?: AgentThinkingLevel;
  /** The thumb moved; the value to show while it is being dragged. */
  onThinkingLevelChange?: (level: AgentThinkingLevel) => void;
  /** The thumb settled; the value to persist. */
  onThinkingLevelCommit?: (level: AgentThinkingLevel) => void;
  isDisabled?: boolean;
  /** A choice is being persisted; the trigger shows it and refuses another until it lands. */
  isPending?: boolean;
  fullWidth?: boolean;
  providerLabels?: Readonly<Record<string, string>>;
  providerIcons?: Readonly<Record<string, ProviderIcon>>;
  /** Providers in the order offered; the rest follow alphabetically. */
  providerOrder?: readonly string[];
  /** Controlled popover state, used by composer commands such as `/model`. */
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
}

/** Controlled. Needs only the labels context. */
export const ModelPicker = ({
  className,
  fallback,
  fullWidth,
  isDisabled,
  isOpen,
  isPending,
  models,
  onChange,
  onOpenChange,
  onThinkingLevelChange,
  onThinkingLevelCommit,
  providerIcons,
  providerLabels,
  providerOrder = [],
  thinkingLevel,
  value,
}: ModelPickerProps) => {
  const labels = useAgentLabels();
  const [internalOpen, setInternalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [rail, setRail] = useState<string | null>(null);
  const open = isOpen ?? internalOpen;

  const setOpen = (next: boolean) => {
    if (isOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) setQuery("");
  };

  const nameOf = (id: string) =>
    providerLabels?.[id] ?? providerLabelOf(id) ?? id;

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
    providers.find((provider) => provider.id === (rail ?? value?.providerId)) ??
    providers[0];

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

  const current = value
    ? (models ?? []).find((model) => keyOf(model) === keyOf(value))
    : undefined;
  const supportsReasoning = current?.supportsReasoning ?? true;
  const showSlider = thinkingLevel !== undefined && supportsReasoning;

  const triggerVendor = value ? vendorOf(value) : null;
  const triggerModel =
    current?.name ?? value?.modelId ?? fallback?.label ?? labels.modelPicker;
  const selectedKey = value ? keyOf(value) : fallback ? FALLBACK_KEY : null;

  return (
    <Popover isOpen={open} onOpenChange={setOpen}>
      <Popover.Trigger>
        <Button
          aria-label={labels.modelPicker}
          className={cn(
            "h-8 gap-1.5 px-2 text-xs",
            fullWidth && "w-full justify-start",
            className
          )}
          isDisabled={isDisabled || isPending}
          isPending={isPending}
          size="sm"
          variant="ghost">
          {triggerVendor ? (
            <ProviderMark
              className="size-3.5"
              icons={providerIcons}
              id={triggerVendor}
            />
          ) : null}
          <span
            className={cn(
              "truncate font-medium",
              fullWidth ? "min-w-0 flex-1 text-left" : "max-w-40"
            )}>
            {triggerModel}
          </span>
          {showSlider ? (
            <>
              <span className="bg-separator mx-0.5 h-3 w-px" />
              <span className="text-muted">
                {labels.thinkingLevelNames[thinkingLevel]}
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

      <Popover.Content
        className="bg-surface/70 max-w-104 min-w-80 p-0 backdrop-blur-sm"
        placement="top start">
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
                  if (key === selectedKey) return;
                  if (key === FALLBACK_KEY) {
                    onChange(null);
                    return;
                  }
                  const next = (models ?? []).find(
                    (model) => keyOf(model) === key
                  );
                  if (next) {
                    onChange({
                      providerId: next.providerId,
                      modelId: next.modelId,
                    });
                  }
                }}
                renderEmptyState={() => (
                  <p className="text-muted px-3 py-6 text-center text-xs">
                    {labels.noModels}
                  </p>
                )}
                selectedKeys={
                  selectedKey === null
                    ? new Set<string>()
                    : new Set([selectedKey])
                }
                selectionMode="single">
                {fallback && query.trim() === "" ? (
                  <ListBox.Item
                    className="py-2"
                    id={FALLBACK_KEY}
                    textValue={fallback.label}>
                    <span className="text-muted truncate">
                      {fallback.label}
                    </span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ) : null}
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

          {showSlider ? (
            <div className="border-border border-t px-4 py-3">
              <ThinkingSlider
                isDisabled={isPending}
                onChange={(next) => onThinkingLevelChange?.(next)}
                onCommit={onThinkingLevelCommit}
                value={thinkingLevel}
              />
            </div>
          ) : null}
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
