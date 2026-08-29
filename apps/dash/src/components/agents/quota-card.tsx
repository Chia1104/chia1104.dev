"use client";

import {
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  NumberField,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

import { OverriddenChip, formatDate, useInvalidateAgentAdmin } from "./shared";

type QuotaAdmin = RouterOutputs["agent"]["admin"]["quota"]["get"];

/**
 * Edited as effective values and written as an override only where they differ from the code
 * default, the way the task card treats its parameters — so typing the default back in
 * restores it.
 */
const quotaFormSchema = z.object({
  weeklyLimitUsd: z.number().min(0).max(10_000),
  resetTimeZone: z.string().min(1).max(100),
  maxRunningTurns: z.number().int().min(0).max(100),
});

type QuotaFormValues = z.infer<typeof quotaFormSchema>;

const formValuesOf = (quota: QuotaAdmin): QuotaFormValues => ({
  weeklyLimitUsd: quota.weeklyLimitUsd.effective,
  resetTimeZone: quota.resetTimeZone.effective,
  maxRunningTurns: quota.maxRunningTurns.effective,
});

export const QuotaCard = ({ quota }: { quota: QuotaAdmin }) => {
  const invalidate = useInvalidateAgentAdmin();
  const form = useForm<QuotaFormValues>({
    resolver: zodResolver(quotaFormSchema),
    defaultValues: formValuesOf(quota),
  });
  const { control, formState, handleSubmit, reset } = form;

  const update = useMutation(
    orpc.agent.admin.quota.update.mutationOptions({
      onSuccess(saved) {
        reset(formValuesOf(saved));
        invalidate();
        toast.success("Usage quota saved");
      },
      onError(error) {
        toast.error(error.message);
      },
    })
  );

  const onSubmit = handleSubmit((values) => {
    const timeZone = values.resetTimeZone.trim();
    update.mutate({
      weeklyLimitUsd:
        values.weeklyLimitUsd === quota.weeklyLimitUsd.default
          ? null
          : values.weeklyLimitUsd,
      resetTimeZone: timeZone === quota.resetTimeZone.default ? null : timeZone,
      maxRunningTurns:
        values.maxRunningTurns === quota.maxRunningTurns.default
          ? null
          : values.maxRunningTurns,
    });
  });

  const overridden =
    quota.weeklyLimitUsd.override !== null ||
    quota.resetTimeZone.override !== null ||
    quota.maxRunningTurns.override !== null;
  const busy = update.isPending;

  return (
    <Card className="w-full" variant="secondary">
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Card.Header>
          <div className="flex flex-wrap items-center gap-2">
            <Card.Title className="text-base">Weekly allowance</Card.Title>
            <OverriddenChip isOverridden={overridden} />
            {quota.updatedAt !== null ? (
              <span className="text-muted-foreground ml-auto text-xs">
                updated {formatDate(quota.updatedAt)}
              </span>
            ) : null}
          </div>
          <Card.Description className="text-xs">
            Applies to every caller below the operator. Counts house-gateway
            spend only — a visitor&apos;s own API key is their own bill. A turn
            is accepted while anything remains, so the last one may overrun by
            one turn.
          </Card.Description>
        </Card.Header>

        <Card.Content className="flex flex-wrap gap-4">
          <Controller
            control={control}
            name="weeklyLimitUsd"
            render={({ field, fieldState }) => (
              <NumberField
                aria-label="Weekly limit in USD"
                formatOptions={{
                  style: "currency",
                  currency: "USD",
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 4,
                }}
                isDisabled={busy}
                isInvalid={fieldState.invalid}
                maxValue={10_000}
                minValue={0}
                onBlur={field.onBlur}
                onChange={(next) =>
                  field.onChange(Number.isNaN(next) ? 0 : next)
                }
                step={0.05}
                value={field.value}>
                <Label className="text-xs">Weekly limit</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-32" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <Description className="text-xs">
                  Default: ${quota.weeklyLimitUsd.default}. Zero closes the
                  agent to everyone but you.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </NumberField>
            )}
          />
          <Controller
            control={control}
            name="resetTimeZone"
            render={({ field, fieldState }) => (
              <TextField
                aria-label="Reset time zone"
                isDisabled={busy}
                isInvalid={fieldState.invalid}
                maxLength={100}
                onBlur={field.onBlur}
                onChange={field.onChange}
                value={field.value}>
                <Label className="text-xs">Reset time zone</Label>
                <Input className="w-56 font-mono" placeholder="Asia/Taipei" />
                <Description className="text-xs">
                  IANA name; the week turns over on its Monday 00:00. Default:
                  the server&apos;s, {quota.resetTimeZone.default}.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </TextField>
            )}
          />
          <Controller
            control={control}
            name="maxRunningTurns"
            render={({ field, fieldState }) => (
              <NumberField
                aria-label="Running turns per visitor"
                isDisabled={busy}
                isInvalid={fieldState.invalid}
                maxValue={100}
                minValue={0}
                onBlur={field.onBlur}
                onChange={(next) =>
                  field.onChange(Number.isNaN(next) ? 0 : next)
                }
                step={1}
                value={field.value}>
                <Label className="text-xs">Running turns per visitor</Label>
                <NumberField.Group>
                  <NumberField.DecrementButton />
                  <NumberField.Input className="w-28" />
                  <NumberField.IncrementButton />
                </NumberField.Group>
                <Description className="text-xs">
                  Turns one visitor may have executing at once, across all their
                  sessions. Default: {quota.maxRunningTurns.default}. Zero
                  closes new turns.
                </Description>
                <FieldError>{fieldState.error?.message}</FieldError>
              </NumberField>
            )}
          />
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
