"use client";

import {
  Button,
  Card,
  Chip,
  Description,
  FieldError,
  Form,
  Label,
  NumberField,
  TextArea,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { TASK_PROMPT_MAX_CHARS } from "@chia/api/orpc/contracts/agent-admin.contract";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import {
  ModelSelect,
  OverriddenChip,
  formatDate,
  modelLabel,
  modelRefSchema,
  useInvalidateAgentAdmin,
} from "./shared";
import type { AgentModelInfo } from "./shared";

type TaskAdmin = RouterOutputs["agent"]["admin"]["tasks"]["list"][number];

const SESSION_MODEL_LABEL = "the session's own model";

/**
 * Prompt and parameters are edited as their *effective* values — the textarea shows the
 * prompt the model will actually see — and written as an override only where they differ
 * from the code, so "restore default" is just the default text back in the box. `null` on a
 * parameter means the box is empty, which also reads as "use the default".
 */
const taskFormSchema = z.object({
  model: modelRefSchema.nullable(),
  prompt: z.string().max(TASK_PROMPT_MAX_CHARS),
  maxTokens: z.number().int().min(1).max(32_768).nullable(),
  temperature: z.number().min(0).max(2).nullable(),
});

type TaskFormValues = z.infer<typeof taskFormSchema>;

const formValuesOf = (task: TaskAdmin): TaskFormValues => ({
  model: task.model.override,
  prompt: task.prompt ? (task.prompt.override ?? task.prompt.default) : "",
  maxTokens: task.params?.effective.maxTokens ?? null,
  temperature: task.params?.effective.temperature ?? null,
});

const defaultModelLabel = (
  model: TaskAdmin["model"]["default"],
  models: readonly AgentModelInfo[] | undefined
) => (model === "session" ? SESSION_MODEL_LABEL : modelLabel(model, models));

export const TaskCard = ({
  models,
  task,
}: {
  task: TaskAdmin;
  models: readonly AgentModelInfo[] | undefined;
}) => {
  const invalidate = useInvalidateAgentAdmin();
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: formValuesOf(task),
  });
  const { control, formState, handleSubmit, reset, setValue, watch } = form;

  const update = useMutation(
    orpc.agent.admin.tasks.update.mutationOptions({
      onSuccess(saved) {
        reset(formValuesOf(saved));
        invalidate();
        toast.success(`${task.label} saved`);
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const onSubmit = handleSubmit((values) => {
    const prompt = values.prompt.trim();
    update.mutate({
      id: task.id,
      model: values.model,
      systemPrompt: task.prompt
        ? prompt === "" || prompt === task.prompt.default
          ? null
          : values.prompt
        : undefined,
      params: task.params
        ? {
            ...(values.maxTokens !== null &&
              values.maxTokens !== task.params.default.maxTokens && {
                maxTokens: values.maxTokens,
              }),
            ...(values.temperature !== null &&
              values.temperature !== task.params.default.temperature && {
                temperature: values.temperature,
              }),
          }
        : undefined,
    });
  });

  const overridden =
    task.model.override !== null ||
    (task.prompt?.override ?? null) !== null ||
    Object.keys(task.params?.override ?? {}).length > 0;

  const busy = update.isPending;
  const prompt = watch("prompt");

  return (
    <Card className="w-full" variant="secondary">
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card.Header>
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-base">{task.label}</Card.Title>
            <Chip size="sm" variant="soft">
              <Chip.Label className="font-mono text-xs">{task.id}</Chip.Label>
            </Chip>
            <OverriddenChip isOverridden={overridden} />
            {task.updatedAt !== null ? (
              <span className="text-muted-foreground ml-auto text-xs">
                updated {formatDate(task.updatedAt)}
              </span>
            ) : null}
          </div>
          <Card.Description className="text-xs">
            {task.description}
          </Card.Description>
        </Card.Header>

        <Card.Content className="flex flex-col gap-4">
          <Controller
            control={control}
            name="model"
            render={({ field }) => (
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Model</Label>
                <ModelSelect
                  defaultLabel={defaultModelLabel(task.model.default, models)}
                  isDisabled={busy}
                  models={models}
                  onChange={field.onChange}
                  value={field.value}
                />
                <Description className="text-xs">
                  A pinned model runs on the house gateway account. Runs on{" "}
                  {task.model.effective === "session"
                    ? SESSION_MODEL_LABEL
                    : modelLabel(task.model.effective, models)}{" "}
                  today.
                </Description>
              </div>
            )}
          />

          {task.prompt ? (
            <Controller
              control={control}
              name="prompt"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">System prompt</Label>
                    {prompt !== task.prompt?.default ? (
                      <Button
                        isDisabled={busy}
                        size="sm"
                        variant="ghost"
                        onPress={() =>
                          setValue("prompt", task.prompt?.default ?? "", {
                            shouldDirty: true,
                          })
                        }>
                        Restore default
                      </Button>
                    ) : null}
                  </div>
                  <TextArea
                    aria-label={`${task.label} system prompt`}
                    className="font-mono text-xs"
                    disabled={busy}
                    maxLength={TASK_PROMPT_MAX_CHARS}
                    onBlur={field.onBlur}
                    onChange={(event) => field.onChange(event.target.value)}
                    rows={10}
                    value={field.value}
                  />
                  <FieldError>{fieldState.error?.message}</FieldError>
                </div>
              )}
            />
          ) : null}

          {task.params ? (
            <div className="flex flex-wrap gap-4">
              <Controller
                control={control}
                name="maxTokens"
                render={({ field, fieldState }) => (
                  <NumberField
                    aria-label="Max tokens"
                    isDisabled={busy}
                    isInvalid={fieldState.invalid}
                    maxValue={32_768}
                    minValue={1}
                    onBlur={field.onBlur}
                    onChange={(next) =>
                      field.onChange(Number.isNaN(next) ? null : next)
                    }
                    step={1}
                    value={field.value ?? Number.NaN}>
                    <Label className="text-xs">Max tokens</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-28" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    <Description className="text-xs">
                      Default: {task.params?.default.maxTokens}
                    </Description>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </NumberField>
                )}
              />
              <Controller
                control={control}
                name="temperature"
                render={({ field, fieldState }) => (
                  <NumberField
                    aria-label="Temperature"
                    formatOptions={{ maximumFractionDigits: 2 }}
                    isDisabled={busy}
                    isInvalid={fieldState.invalid}
                    maxValue={2}
                    minValue={0}
                    onBlur={field.onBlur}
                    onChange={(next) =>
                      field.onChange(Number.isNaN(next) ? null : next)
                    }
                    step={0.1}
                    value={field.value ?? Number.NaN}>
                    <Label className="text-xs">Temperature</Label>
                    <NumberField.Group>
                      <NumberField.DecrementButton />
                      <NumberField.Input className="w-28" />
                      <NumberField.IncrementButton />
                    </NumberField.Group>
                    <Description className="text-xs">
                      Default: {task.params?.default.temperature}
                    </Description>
                    <FieldError>{fieldState.error?.message}</FieldError>
                  </NumberField>
                )}
              />
            </div>
          ) : null}
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
