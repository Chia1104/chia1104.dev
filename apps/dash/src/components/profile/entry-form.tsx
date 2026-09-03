"use client";

import { useState } from "react";

import {
  Button,
  Calendar,
  Card,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  NumberField,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseDate } from "@internationalized/date";
import { Controller, useForm } from "react-hook-form";
import type { Control } from "react-hook-form";

import { Markdown } from "@chia/agent-elements/markdown";
import { Locale, ProfileEntryKind } from "@chia/db/types";
import { PROFILE_CONTENT_MAX_CHARS } from "@chia/db/validator/profile";

import {
  LOCALES,
  emptyFormValues,
  formValuesOf,
  profileFormSchema,
} from "./form";
import type {
  ProfileEntryView,
  ProfileEntryWrite,
  ProfileFormInput,
  ProfileFormOutput,
} from "./form";

export interface EntryFormProps {
  kind: ProfileEntryKind;
  /** Absent for a new entry. */
  entry?: ProfileEntryView;
  isPending: boolean;
  onSubmit: (write: ProfileEntryWrite) => void;
}

const LOCALE_LABEL = {
  [Locale.zhTW]: "中文",
  [Locale.En]: "English",
} satisfies Record<Locale, string>;

const SORT_ORDER_LIMIT = 10_000;

type FormControl = Control<ProfileFormInput, unknown, ProfileFormOutput>;

type TextFieldName =
  | "data.organization"
  | "data.url"
  | "data.location"
  | "data.repository"
  | "data.image"
  | "data.stack"
  | `data.translations.${Locale}.title`
  | `data.translations.${Locale}.summary`;

/** Fields sit on the drawer's overlay surface; `secondary` is the variant that stays visible there in dark mode. */
const FIELD_VARIANT = "secondary";

const TextInput = ({
  control,
  description,
  isDisabled,
  label,
  mono,
  name,
  placeholder,
}: {
  control: FormControl;
  description?: string;
  isDisabled: boolean;
  label: string;
  mono?: boolean;
  name: TextFieldName;
  placeholder?: string;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <TextField
        className="min-w-48 flex-1"
        isDisabled={isDisabled}
        isInvalid={fieldState.invalid}
        onBlur={field.onBlur}
        onChange={field.onChange}
        value={field.value}>
        <Label className="text-xs">{label}</Label>
        <Input
          className={mono ? "font-mono text-xs" : undefined}
          placeholder={placeholder}
          variant={FIELD_VARIANT}
        />
        {description ? (
          <Description className="text-xs">{description}</Description>
        ) : null}
        <FieldError>{fieldState.error?.message}</FieldError>
      </TextField>
    )}
  />
);

const DateInput = ({
  control,
  description,
  isDisabled,
  label,
  name,
}: {
  control: FormControl;
  description: string;
  isDisabled: boolean;
  label: string;
  name: "data.startDate" | "data.endDate";
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <DatePicker
        className="min-w-48 flex-1"
        isDisabled={isDisabled}
        isInvalid={fieldState.invalid}
        onBlur={field.onBlur}
        onChange={(date) => field.onChange(date?.toString() ?? "")}
        value={field.value === "" ? null : parseDate(field.value)}>
        <Label className="text-xs">{label}</Label>
        <DateField.Group fullWidth variant={FIELD_VARIANT}>
          <DateField.Input>
            {(segment) => <DateField.Segment segment={segment} />}
          </DateField.Input>
          <DateField.Suffix>
            <DatePicker.Trigger>
              <DatePicker.TriggerIndicator />
            </DatePicker.Trigger>
          </DateField.Suffix>
        </DateField.Group>
        <Description className="text-xs">{description}</Description>
        <FieldError>{fieldState.error?.message}</FieldError>
        <DatePicker.Popover>
          <Calendar aria-label={label}>
            <Calendar.Header>
              <Calendar.YearPickerTrigger>
                <Calendar.YearPickerTriggerHeading />
                <Calendar.YearPickerTriggerIndicator />
              </Calendar.YearPickerTrigger>
              <Calendar.NavButton slot="previous" />
              <Calendar.NavButton slot="next" />
            </Calendar.Header>
            <Calendar.Grid>
              <Calendar.GridHeader>
                {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
              </Calendar.GridHeader>
              <Calendar.GridBody>
                {(date) => <Calendar.Cell date={date} />}
              </Calendar.GridBody>
            </Calendar.Grid>
            <Calendar.YearPickerGrid>
              <Calendar.YearPickerGridBody>
                {({ year }) => (
                  <Calendar.YearPickerCell className="text-xs" year={year} />
                )}
              </Calendar.YearPickerGridBody>
            </Calendar.YearPickerGrid>
          </Calendar>
        </DatePicker.Popover>
      </DatePicker>
    )}
  />
);

const Tenure = ({
  control,
  isDisabled,
  required,
}: {
  control: FormControl;
  isDisabled: boolean;
  /** Experience and education always start somewhere; a project may be undated. */
  required: boolean;
}) => (
  <div className="flex flex-wrap gap-4">
    <DateInput
      control={control}
      description={required ? "When it began" : "When it began, if dated"}
      isDisabled={isDisabled}
      label="Start"
      name="data.startDate"
    />
    <DateInput
      control={control}
      description="Blank means ongoing"
      isDisabled={isDisabled}
      label="End"
      name="data.endDate"
    />
  </div>
);

const StackInput = ({
  control,
  isDisabled,
}: {
  control: FormControl;
  isDisabled: boolean;
}) => (
  <TextInput
    control={control}
    description="Comma-separated"
    isDisabled={isDisabled}
    label="Stack"
    name="data.stack"
    placeholder="TypeScript, React, Next.js"
  />
);

const KindFields = ({
  control,
  isDisabled,
  kind,
}: {
  control: FormControl;
  isDisabled: boolean;
  kind: ProfileEntryKind;
}) => {
  switch (kind) {
    case ProfileEntryKind.About:
      return null;
    case ProfileEntryKind.Experience:
      return (
        <>
          <div className="flex flex-wrap gap-4">
            <TextInput
              control={control}
              isDisabled={isDisabled}
              label="Organization"
              name="data.organization"
            />
            <TextInput
              control={control}
              isDisabled={isDisabled}
              label="Location"
              name="data.location"
              placeholder="Taipei, Taiwan"
            />
          </div>
          <TextInput
            control={control}
            isDisabled={isDisabled}
            label="URL"
            mono
            name="data.url"
            placeholder="https://"
          />
          <Tenure control={control} isDisabled={isDisabled} required />
          <StackInput control={control} isDisabled={isDisabled} />
        </>
      );
    case ProfileEntryKind.Education:
      return (
        <>
          <TextInput
            control={control}
            isDisabled={isDisabled}
            label="Organization"
            name="data.organization"
          />
          <TextInput
            control={control}
            isDisabled={isDisabled}
            label="URL"
            mono
            name="data.url"
            placeholder="https://"
          />
          <Tenure control={control} isDisabled={isDisabled} required />
        </>
      );
    case ProfileEntryKind.Project:
      return (
        <>
          <div className="flex flex-wrap gap-4">
            <TextInput
              control={control}
              isDisabled={isDisabled}
              label="URL"
              mono
              name="data.url"
              placeholder="https://"
            />
            <TextInput
              control={control}
              isDisabled={isDisabled}
              label="Repository"
              mono
              name="data.repository"
              placeholder="https://github.com/"
            />
          </div>
          <TextInput
            control={control}
            isDisabled={isDisabled}
            label="Image URL"
            mono
            name="data.image"
            placeholder="https://"
          />
          <Tenure control={control} isDisabled={isDisabled} required={false} />
          <StackInput control={control} isDisabled={isDisabled} />
        </>
      );
  }
};

const ContentEditor = ({
  control,
  isDisabled,
  locale,
}: {
  control: FormControl;
  isDisabled: boolean;
  locale: Locale;
}) => {
  const [preview, setPreview] = useState(false);
  return (
    <Controller
      control={control}
      name={`data.translations.${locale}.content`}
      render={({ field, fieldState }) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Content (markdown)</Label>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => setPreview((value) => !value)}>
              {preview ? "Edit" : "Preview"}
            </Button>
          </div>
          {preview ? (
            <Card variant="tertiary" className="rounded-md p-3">
              <Card.Content>
                <Markdown text={field.value || "*Nothing yet*"} />
              </Card.Content>
            </Card>
          ) : (
            <TextArea
              aria-label={`${LOCALE_LABEL[locale]} content`}
              className="font-mono text-xs"
              disabled={isDisabled}
              maxLength={PROFILE_CONTENT_MAX_CHARS}
              onBlur={field.onBlur}
              onChange={(event) => field.onChange(event.target.value)}
              rows={12}
              value={field.value}
              variant={FIELD_VARIANT}
            />
          )}
          {fieldState.error ? (
            <p className="text-danger text-xs">{fieldState.error.message}</p>
          ) : null}
        </div>
      )}
    />
  );
};

export const EntryForm = ({
  entry,
  isPending,
  kind,
  onSubmit,
}: EntryFormProps) => {
  const { control, formState, handleSubmit } = useForm<
    ProfileFormInput,
    unknown,
    ProfileFormOutput
  >({
    resolver: zodResolver(profileFormSchema),
    defaultValues: entry ? formValuesOf(entry) : emptyFormValues(kind),
  });

  const submit = handleSubmit((write) => onSubmit(write));
  const translationsError = formState.errors.data?.translations?.message;

  return (
    <Form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <Controller
          control={control}
          name="published"
          render={({ field }) => (
            <Switch
              isDisabled={isPending}
              isSelected={field.value}
              onChange={field.onChange}>
              <Switch.Content className="flex flex-col items-start gap-1">
                <div className="flex flex-col items-start gap-1">
                  <Label className="text-xs">Published</Label>
                  <Description className="text-xs">
                    Only published entries reach the site and the agent.
                  </Description>
                </div>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        />
        <Controller
          control={control}
          name="sortOrder"
          render={({ field, fieldState }) => (
            <NumberField
              isDisabled={isPending}
              isInvalid={fieldState.invalid}
              maxValue={SORT_ORDER_LIMIT}
              minValue={-SORT_ORDER_LIMIT}
              onBlur={field.onBlur}
              onChange={(next) => field.onChange(Number.isNaN(next) ? 0 : next)}
              step={1}
              value={field.value}
              variant={FIELD_VARIANT}>
              <Label className="text-xs">Order</Label>
              <NumberField.Group>
                <NumberField.DecrementButton />
                <NumberField.Input className="w-24" />
                <NumberField.IncrementButton />
              </NumberField.Group>
              <Description className="text-xs">Lower comes first.</Description>
              <FieldError>{fieldState.error?.message}</FieldError>
            </NumberField>
          )}
        />
      </div>

      <KindFields control={control} isDisabled={isPending} kind={kind} />

      <Tabs defaultSelectedKey={Locale.zhTW}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Locale">
            {LOCALES.map((locale) => (
              <Tabs.Tab key={locale} id={locale}>
                {LOCALE_LABEL[locale]}
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
        {LOCALES.map((locale) => (
          <Tabs.Panel
            key={locale}
            className="flex flex-col gap-3 pt-3"
            id={locale}>
            <TextInput
              control={control}
              description="Leave blank to skip this locale."
              isDisabled={isPending}
              label={`${LOCALE_LABEL[locale]} title`}
              name={`data.translations.${locale}.title`}
            />
            <TextInput
              control={control}
              isDisabled={isPending}
              label={`${LOCALE_LABEL[locale]} summary`}
              name={`data.translations.${locale}.summary`}
            />
            <ContentEditor
              control={control}
              isDisabled={isPending}
              locale={locale}
            />
          </Tabs.Panel>
        ))}
      </Tabs>

      {translationsError ? (
        <p className="text-danger text-sm">{translationsError}</p>
      ) : null}

      <div className="flex gap-2">
        <Button
          isDisabled={entry !== undefined && !formState.isDirty}
          isPending={isPending}
          type="submit"
          variant="primary">
          {entry ? "Save" : "Create"}
        </Button>
      </div>
    </Form>
  );
};
