"use client";

import { useMemo } from "react";

import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Chip,
  Description,
  Form,
  Label,
  Switch,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { ThinkingSlider } from "@chia/agent-elements/thinking-slider";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import {
  ConfigFields,
  configFieldValueSchema,
  configFormValueOf,
  configOverrideOf,
} from "./config-fields";
import {
  ModelSelect,
  OverriddenChip,
  formatDate,
  modelLabel,
  modelRefSchema,
  useInvalidateAgentAdmin,
} from "./shared";

type KindAdmin = RouterOutputs["agent"]["admin"]["kinds"]["list"][number];

const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

/** The form is the override: `null` on a field means "whatever the code says". */
const kindFormSchema = z.object({
  model: modelRefSchema.nullable(),
  thinkingLevel: z.enum(THINKING_LEVELS).nullable(),
  autoApprove: z.array(z.string()).nullable(),
  config: z.record(z.string(), configFieldValueSchema),
});

type KindFormValues = z.infer<typeof kindFormSchema>;

const formValuesOf = (kind: KindAdmin): KindFormValues => ({
  model: kind.defaults.override.model,
  thinkingLevel: kind.defaults.override.thinkingLevel,
  autoApprove: kind.defaults.override.autoApprove,
  config: configFormValueOf(kind.config.schema, kind.config.override),
});

/** `CallerTier` values, as the contract carries them. */
const audienceOf = (minTier: number): string => {
  switch (minTier) {
    case 0:
      return "anyone";
    case 1:
      return "guests and signed-in users";
    case 2:
      return "API-key callers";
    case 3:
      return "signed-in users";
    case 4:
      return "the author only";
    default:
      return `tier ${minTier}`;
  }
};

/**
 * One agent kind: what a new session starts with, and the kind's own configuration. The
 * form edits the *override* — every field has a "default" state that means "whatever the
 * code says" — and is remounted by its parent after a save, so it never has to reconcile a
 * refetch with an edit in progress.
 */
export const KindCard = ({ kind }: { kind: KindAdmin }) => {
  const invalidate = useInvalidateAgentAdmin();
  const form = useForm<KindFormValues>({
    resolver: zodResolver(kindFormSchema),
    defaultValues: formValuesOf(kind),
  });
  const { control, formState, handleSubmit, reset, setValue, watch } = form;

  const models = useQuery(
    orpc.agent.models.list.queryOptions({ input: { kind: kind.kind } })
  );
  const capabilities = useQuery(
    orpc.agent.capabilities.list.queryOptions({ input: { kind: kind.kind } })
  );
  const tiers = useMemo(
    () => [...new Set(capabilities.data?.tools.map((tool) => tool.tier) ?? [])],
    [capabilities.data]
  );

  const update = useMutation(
    orpc.agent.admin.kinds.update.mutationOptions({
      onSuccess(saved) {
        reset(formValuesOf(saved));
        invalidate();
        toast.success(`${kind.label} saved`);
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const onSubmit = handleSubmit((values) =>
    update.mutate({
      kind: kind.kind,
      model: values.model,
      thinkingLevel: values.thinkingLevel,
      autoApprove: values.autoApprove,
      config: configOverrideOf(values.config),
    })
  );

  const overridden =
    kind.defaults.override.model !== null ||
    kind.defaults.override.thinkingLevel !== null ||
    kind.defaults.override.autoApprove !== null ||
    Object.keys(kind.config.override).length > 0;

  const code = kind.defaults.code;
  const busy = update.isPending;
  const autoApprove = watch("autoApprove");

  return (
    <Card className="w-full" variant="secondary">
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card.Header>
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-base">{kind.label}</Card.Title>
            <Chip size="sm" variant="soft">
              <Chip.Label className="font-mono text-xs">{kind.kind}</Chip.Label>
            </Chip>
            <OverriddenChip isOverridden={overridden} />
            {kind.updatedAt !== null ? (
              <span className="text-muted-foreground ml-auto text-xs">
                updated {formatDate(kind.updatedAt)}
              </span>
            ) : null}
          </div>
          <Card.Description className="text-xs">
            {kind.description} Available to {audienceOf(kind.minTier)}.
          </Card.Description>
        </Card.Header>

        <Card.Content className="flex flex-col gap-6">
          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-medium">New session defaults</h3>
              <p className="text-muted-foreground text-xs">
                Copied onto a session when it is created. Sessions that already
                exist keep their own settings.
              </p>
            </div>

            <Controller
              control={control}
              name="model"
              render={({ field }) => (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Model</Label>
                  <ModelSelect
                    defaultLabel={modelLabel(code, models.data)}
                    isDisabled={busy}
                    models={models.data}
                    onChange={field.onChange}
                    value={field.value}
                  />
                </div>
              )}
            />

            <Controller
              control={control}
              name="thinkingLevel"
              render={({ field }) => (
                <div className="flex w-full max-w-md flex-col gap-1">
                  <ThinkingSlider
                    isDisabled={busy}
                    onChange={field.onChange}
                    value={field.value ?? code.thinkingLevel}
                  />
                  <div className="flex h-7 items-center justify-between">
                    <span className="text-muted-foreground text-xs">
                      Default: {code.thinkingLevel}
                    </span>
                    {field.value !== null ? (
                      <Button
                        className="h-6 text-xs"
                        isDisabled={busy}
                        size="sm"
                        variant="ghost"
                        onPress={() => field.onChange(null)}>
                        Use default
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}
            />

            <div className="flex flex-col gap-2">
              <Switch
                isDisabled={busy || tiers.length === 0}
                isSelected={autoApprove !== null}
                onChange={(selected) =>
                  setValue("autoApprove", selected ? [] : null, {
                    shouldDirty: true,
                  })
                }>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label className="text-xs">
                    Override pre-approved tool tiers
                  </Label>
                  <Description className="text-xs">
                    Default:{" "}
                    {code.autoApprove.length > 0
                      ? code.autoApprove.join(", ")
                      : "none — every gated tool asks first"}
                  </Description>
                </Switch.Content>
              </Switch>
              {autoApprove !== null ? (
                <Controller
                  control={control}
                  name="autoApprove"
                  render={({ field }) => (
                    <CheckboxGroup
                      aria-label="Pre-approved tool tiers"
                      className="flex-row gap-4 pl-1"
                      isDisabled={busy}
                      onBlur={field.onBlur}
                      onChange={field.onChange}
                      value={field.value ?? []}>
                      {tiers.map((tier) => (
                        <Checkbox key={tier} value={tier}>
                          <Checkbox.Content>
                            <Checkbox.Control>
                              <Checkbox.Indicator />
                            </Checkbox.Control>
                            <span className="font-mono text-xs">{tier}</span>
                          </Checkbox.Content>
                        </Checkbox>
                      ))}
                    </CheckboxGroup>
                  )}
                />
              ) : null}
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div>
              <h3 className="text-sm font-medium">Configuration</h3>
              <p className="text-muted-foreground text-xs">
                Read on every turn, so a change reaches every session from its
                next message.
              </p>
            </div>
            <ConfigFields
              control={control}
              defaults={kind.config.defaults}
              isDisabled={busy}
              name="config"
              schema={kind.config.schema}
            />
          </section>
        </Card.Content>

        <Card.Footer className="flex items-center gap-2">
          <Button
            isDisabled={!formState.isDirty}
            isPending={busy}
            size="sm"
            type="submit"
            variant="primary">
            Save
          </Button>
          <Button
            isDisabled={!formState.isDirty || busy}
            size="sm"
            variant="ghost"
            onPress={() => reset()}>
            Discard changes
          </Button>
        </Card.Footer>
      </Form>
    </Card>
  );
};
