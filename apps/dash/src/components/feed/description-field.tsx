"use client";

import {
  Button,
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
import type { FormSchema } from "@/store/draft/slices/edit-fields";

export const DescriptionField = ({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) => {
  const form = useFormContext<FormSchema>();
  const activeLocale = form.watch("activeLocale");
  const title = form.watch(`translations.${activeLocale}.title`);
  const content = form.watch(`translations.${activeLocale}.content.content`);

  const generateDescriptionMutation = useMutation({
    mutationFn: generateAIContentMeta,
  });

  return (
    <Controller
      key={activeLocale}
      control={form.control}
      name={`translations.${activeLocale}.description`}
      render={({ field, fieldState: { invalid, error } }) => (
        <TextField isInvalid={invalid} fullWidth>
          <Label htmlFor={`${id}-description-${activeLocale}`}>
            Description
          </Label>
          <InputGroup fullWidth>
            <InputGroup.TextArea
              id={`${id}-description-${activeLocale}`}
              disabled={disabled}
              placeholder="Enter description"
              rows={7}
              {...field}
              value={field.value ?? ""}
            />
            <InputGroup.Suffix>
              <Button
                className="size-7.5 rounded-xl"
                size="sm"
                variant="secondary"
                isIconOnly
                aria-label="generate description"
                isPending={generateDescriptionMutation.isPending}
                onPress={() =>
                  generateDescriptionMutation.mutate(
                    {
                      feature: SupportedTools.GenerateDescription,
                      input: {
                        title: title ?? "",
                        content: content ?? undefined,
                        locale: activeLocale,
                      },
                    },
                    {
                      onSuccess: (data) => {
                        if (
                          data.feature === SupportedTools.GenerateDescription
                        ) {
                          field.onChange(data.content.description);
                        }
                      },
                      onError: (err) => {
                        toast.error(err.message);
                      },
                    }
                  )
                }>
                <Sparkle className="size-3.5" />
              </Button>
            </InputGroup.Suffix>
          </InputGroup>
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
};
