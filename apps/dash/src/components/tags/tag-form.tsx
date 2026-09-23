"use client";

import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  TextArea,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Control } from "react-hook-form";

import type { Locale } from "@chia/db/types";
import {
  TAG_DESCRIPTION_MAX_CHARS,
  TAG_NAME_MAX_CHARS,
  TAG_SLUG_MAX_CHARS,
} from "@chia/db/validator/tags";

import {
  LOCALES,
  LOCALE_LABEL,
  emptyFormValues,
  formValuesOf,
  tagFormSchema,
} from "./form";
import type { TagFormInput, TagFormOutput, TagView, TagWrite } from "./form";

export interface TagFormProps {
  /** Absent for a new tag. */
  tag?: TagView;
  isPending: boolean;
  onSubmit: (write: TagWrite) => void;
}

/** Fields sit on the drawer's overlay surface; `secondary` is the variant that stays visible there in dark mode. */
const FIELD_VARIANT = "secondary";

type FormControl = Control<TagFormInput, unknown, TagFormOutput>;

const LocaleFields = ({
  control,
  isDisabled,
  locale,
}: {
  control: FormControl;
  isDisabled: boolean;
  locale: Locale;
}) => (
  <fieldset className="border-border flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border p-3">
    <legend className="px-1 text-xs font-medium">{LOCALE_LABEL[locale]}</legend>
    <Controller
      control={control}
      name={`translations.${locale}.name`}
      render={({ field, fieldState }) => (
        <TextField
          isDisabled={isDisabled}
          isInvalid={fieldState.invalid}
          maxLength={TAG_NAME_MAX_CHARS}
          onBlur={field.onBlur}
          onChange={field.onChange}
          value={field.value}>
          <Label className="text-xs">Name</Label>
          <Input variant={FIELD_VARIANT} />
          <FieldError>{fieldState.error?.message}</FieldError>
        </TextField>
      )}
    />
    <Controller
      control={control}
      name={`translations.${locale}.description`}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Description</Label>
          <TextArea
            aria-label={`${LOCALE_LABEL[locale]} description`}
            className="text-xs"
            disabled={isDisabled}
            maxLength={TAG_DESCRIPTION_MAX_CHARS}
            onBlur={field.onBlur}
            onChange={(event) => field.onChange(event.target.value)}
            rows={3}
            value={field.value ?? ""}
            variant={FIELD_VARIANT}
          />
          {fieldState.error ? (
            <p className="text-danger text-xs">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  </fieldset>
);

export const TagForm = ({ tag, isPending, onSubmit }: TagFormProps) => {
  const { control, handleSubmit } = useForm<
    TagFormInput,
    unknown,
    TagFormOutput
  >({
    resolver: zodResolver(tagFormSchema),
    defaultValues: tag ? formValuesOf(tag) : emptyFormValues(),
  });

  return (
    <Form
      onSubmit={handleSubmit((write) => onSubmit(write))}
      className="flex flex-col gap-4">
      <Controller
        control={control}
        name="slug"
        render={({ field, fieldState }) => (
          <TextField
            isDisabled={isPending}
            isInvalid={fieldState.invalid}
            maxLength={TAG_SLUG_MAX_CHARS}
            onBlur={field.onBlur}
            onChange={field.onChange}
            value={field.value}>
            <Label className="text-xs">Slug</Label>
            <Input
              className="font-mono text-xs"
              placeholder="next-js"
              variant={FIELD_VARIANT}
            />
            <Description className="text-xs">
              Lowercase words joined by hyphens. Changing it changes the tag's
              URL on the site.
            </Description>
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )}
      />
      <div className="flex flex-col gap-3 md:flex-row">
        {LOCALES.map((locale) => (
          <LocaleFields
            key={locale}
            control={control}
            isDisabled={isPending}
            locale={locale}
          />
        ))}
      </div>
      <div className="flex justify-end">
        <Button isPending={isPending} type="submit" variant="primary">
          {tag ? "Save" : "Create"}
        </Button>
      </div>
    </Form>
  );
};
