"use client";

import {
  Button,
  Calendar,
  DateField,
  DatePicker,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  NumberField,
  Select,
  Switch,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { parseDate } from "@internationalized/date";
import { Controller, useForm } from "react-hook-form";
import type { Control } from "react-hook-form";

import { Locale, MediaStatus } from "@chia/db/types";
import {
  MEDIA_COMMENT_MAX_CHARS,
  MEDIA_RATING_MAX,
} from "@chia/db/validator/media";
import { isEnumValue } from "@chia/utils/is";

import { LOCALES, STATUS_OPTIONS, formValuesOf, mediaFormSchema } from "./form";
import type {
  MediaEntryUpdate,
  MediaEntryView,
  MediaFormInput,
  MediaFormOutput,
} from "./form";

const LOCALE_LABEL = {
  [Locale.ZhTW]: "中文",
  [Locale.En]: "English",
} satisfies Record<Locale, string>;

type FormControl = Control<MediaFormInput, unknown, MediaFormOutput>;

/** Fields sit on the drawer's overlay surface; `secondary` is the variant that stays visible there in dark mode. */
const FIELD_VARIANT = "secondary";

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
  name: "startedOn" | "finishedOn";
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

/** An emptied number field reports `NaN`; the stored value for "not set" is `null`. */
const NullableNumberInput = ({
  control,
  description,
  isDisabled,
  label,
  maxValue,
  minValue,
  name,
}: {
  control: FormControl;
  description: string;
  isDisabled: boolean;
  label: string;
  maxValue: number;
  minValue: number;
  name: "rating" | "releaseYear";
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <NumberField
        formatOptions={{ useGrouping: false }}
        isDisabled={isDisabled}
        isInvalid={fieldState.invalid}
        maxValue={maxValue}
        minValue={minValue}
        onBlur={field.onBlur}
        onChange={(next) => field.onChange(Number.isNaN(next) ? null : next)}
        step={1}
        value={field.value ?? Number.NaN}
        variant={FIELD_VARIANT}>
        <Label className="text-xs">{label}</Label>
        <NumberField.Group>
          <NumberField.DecrementButton />
          <NumberField.Input className="w-24" />
          <NumberField.IncrementButton />
        </NumberField.Group>
        <Description className="text-xs">{description}</Description>
        <FieldError>{fieldState.error?.message}</FieldError>
      </NumberField>
    )}
  />
);

export const EntryForm = ({
  entry,
  isPending,
  onSubmit,
}: {
  entry: MediaEntryView;
  isPending: boolean;
  onSubmit: (update: MediaEntryUpdate) => void;
}) => {
  const { control, formState, handleSubmit } = useForm<
    MediaFormInput,
    unknown,
    MediaFormOutput
  >({
    resolver: zodResolver(mediaFormSchema),
    defaultValues: formValuesOf(entry),
  });

  const submit = handleSubmit((update) => onSubmit(update));
  const translationsError = formState.errors.translations?.message;

  return (
    <Form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start gap-4">
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <Select
              className="w-40"
              isDisabled={isPending}
              onChange={(key) => {
                if (key !== null && isEnumValue(MediaStatus, key))
                  field.onChange(key);
              }}
              value={field.value}
              variant={FIELD_VARIANT}>
              <Label className="text-xs">Status</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox items={STATUS_OPTIONS}>
                  {(item) => (
                    <ListBox.Item id={item.id}>{item.label}</ListBox.Item>
                  )}
                </ListBox>
              </Select.Popover>
            </Select>
          )}
        />
        <NullableNumberInput
          control={control}
          description={`1 to ${MEDIA_RATING_MAX}; blank for unrated.`}
          isDisabled={isPending}
          label="Rating"
          maxValue={MEDIA_RATING_MAX}
          minValue={1}
          name="rating"
        />
        <Controller
          control={control}
          name="favorite"
          render={({ field }) => (
            <Switch
              isDisabled={isPending}
              isSelected={field.value}
              onChange={field.onChange}>
              <Switch.Content className="flex flex-col items-start gap-1">
                <div className="flex flex-col items-start gap-1">
                  <Label className="text-xs">Favorite</Label>
                  <Description className="text-xs">
                    Shown with a sticker and on the favorites shelf.
                  </Description>
                </div>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          )}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <DateInput
          control={control}
          description="Blank if you do not remember."
          isDisabled={isPending}
          label="Started"
          name="startedOn"
        />
        <DateInput
          control={control}
          description="The day you finished it; orders the log."
          isDisabled={isPending}
          label="Finished"
          name="finishedOn"
        />
      </div>

      <Tabs defaultSelectedKey={Locale.ZhTW}>
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
            <Controller
              control={control}
              name={`translations.${locale}.title`}
              render={({ field, fieldState }) => (
                <TextField
                  isDisabled={isPending}
                  isInvalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  value={field.value}>
                  <Label className="text-xs">{`${LOCALE_LABEL[locale]} title`}</Label>
                  <Input variant={FIELD_VARIANT} />
                  <Description className="text-xs">
                    Leave blank to show the other locale&apos;s title.
                  </Description>
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
            <Controller
              control={control}
              name={`translations.${locale}.comment`}
              render={({ field, fieldState }) => (
                <TextField
                  isDisabled={isPending}
                  isInvalid={fieldState.invalid}
                  onBlur={field.onBlur}
                  onChange={field.onChange}
                  value={field.value}>
                  <Label className="text-xs">{`${LOCALE_LABEL[locale]} comment`}</Label>
                  <TextArea
                    maxLength={MEDIA_COMMENT_MAX_CHARS}
                    rows={4}
                    variant={FIELD_VARIANT}
                  />
                  <Description className="text-xs">
                    A short take shown beside the cover.
                  </Description>
                  <FieldError>{fieldState.error?.message}</FieldError>
                </TextField>
              )}
            />
          </Tabs.Panel>
        ))}
      </Tabs>

      {translationsError ? (
        <p className="text-danger text-sm">{translationsError}</p>
      ) : null}

      <div className="flex flex-wrap items-start gap-4">
        <Controller
          control={control}
          name="originalTitle"
          render={({ field, fieldState }) => (
            <TextField
              className="min-w-48 flex-1"
              isDisabled={isPending}
              isInvalid={fieldState.invalid}
              onBlur={field.onBlur}
              onChange={field.onChange}
              value={field.value}>
              <Label className="text-xs">Original title</Label>
              <Input variant={FIELD_VARIANT} />
              <FieldError>{fieldState.error?.message}</FieldError>
            </TextField>
          )}
        />
        <NullableNumberInput
          control={control}
          description="Year of first release."
          isDisabled={isPending}
          label="Year"
          maxValue={2200}
          minValue={1870}
          name="releaseYear"
        />
      </div>

      <div className="flex gap-2">
        <Button
          isDisabled={!formState.isDirty}
          isPending={isPending}
          type="submit"
          variant="primary">
          Save
        </Button>
      </div>
    </Form>
  );
};
