"use client";

import { memo, useId } from "react";

import {
  Button,
  Description,
  FieldError,
  InputGroup,
  Label,
  TextField,
} from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { Sparkle } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { SupportedTools } from "@chia/ai/types";

import { generateAIContentMeta } from "@/resources/ai.resource";

import type { DraftFormValues } from "./draft-form-schema";

export const SlugField = memo(({ isBound }: { isBound: boolean }) => {
  const id = useId();
  const form = useFormContext<DraftFormValues>();

  const activeLocale = form.watch("activeLocale");
  const title = form.watch(`translations.${activeLocale}.title`);

  const generateSlugMutation = useMutation({
    mutationFn: generateAIContentMeta,
  });

  return (
    <Controller
      control={form.control}
      name="slug"
      render={({ field, fieldState: { invalid, error } }) => (
        <TextField isInvalid={invalid} fullWidth>
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <InputGroup fullWidth>
            <InputGroup.Input
              id={`${id}-slug`}
              disabled={isBound}
              placeholder="slug"
              {...field}
              value={field.value ?? ""}
            />
            <InputGroup.Suffix>
              <Button
                className="size-6.5 rounded-lg"
                size="sm"
                variant="secondary"
                isIconOnly
                aria-label="generate slug"
                isDisabled={isBound}
                isPending={generateSlugMutation.isPending}
                onPress={() =>
                  generateSlugMutation.mutate(
                    {
                      feature: SupportedTools.GenerateSlug,
                      input: {
                        title: title ?? "",
                      },
                    },
                    {
                      onSuccess: (data) => {
                        if (data.feature === SupportedTools.GenerateSlug) {
                          field.onChange(data.content.slug);
                        }
                      },
                      onError: (err) => {
                        toast.error(err.message);
                      },
                    }
                  )
                }>
                <Sparkle className="size-3" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError>{error?.message}</FieldError>
          {!isBound && (
            <Description>
              The slug will be generated based on the title (cannot be changed
              after creation)
            </Description>
          )}
        </TextField>
      )}
    />
  );
});
