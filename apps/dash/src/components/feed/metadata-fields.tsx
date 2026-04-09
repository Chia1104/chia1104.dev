"use client";

import { memo, useId } from "react";

import {
  Calendar,
  DateField,
  DatePicker,
  Label,
  ListBox,
  Select,
  Switch,
} from "@heroui/react";
import { parseAbsolute, getLocalTimeZone } from "@internationalized/date";
import { Controller, useFormContext } from "react-hook-form";

import dayjs from "@chia/utils/day";

import { useEditFields } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { CONTENT_TYPE_OPTIONS } from "./constants";
import { DefaultLocaleField } from "./default-locale-field";
import { DeleteButton } from "./delete-button";
import { DescriptionField } from "./description-field";
import { FeedTypeTabs } from "./feed-type-tabs";
import { LocaleTabs } from "./locale-tabs";
import { MetaChip } from "./meta-chip";
import type { MetaChipProps } from "./meta-chip";
import { SlugField } from "./slug-field";
import { TitleField } from "./title-field";

export const MetadataFields = memo(
  ({ feedId, meta }: { feedId?: number; meta?: MetaChipProps }) => {
    const id = useId();
    const form = useFormContext<FormSchema>();
    const { disabled, mode } = useEditFields();

    const showMetaInfo = mode === "edit" && feedId;
    const showUpdatedDate = mode === "edit";

    return (
      <div className="flex w-full flex-col gap-5">
        <div className="flex items-center justify-between">
          <FeedTypeTabs />
          {showMetaInfo && feedId && (
            <div className="flex items-center gap-2">
              <MetaChip {...meta} />
              <DeleteButton
                feedId={feedId}
                type={form.watch("type")}
                deleted={!!meta?.deleted}
              />
            </div>
          )}
        </div>

        <SlugField />

        <div className="flex w-full flex-col gap-5 md:flex-row">
          <div className="flex flex-col gap-2 md:w-1/2 md:flex-row">
            <Controller
              control={form.control}
              name="createdAt"
              render={({ fieldState: { invalid }, field }) => (
                <DatePicker
                  hideTimeZone
                  className="w-full md:w-1/2"
                  name="createdAt"
                  onChange={(value) =>
                    field.onChange(dayjs(value?.toString()).valueOf())
                  }
                  isInvalid={invalid}
                  value={
                    field.value
                      ? parseAbsolute(
                          dayjs(field.value).toISOString(),
                          getLocalTimeZone()
                        )
                      : null
                  }>
                  <Label>Created Date</Label>
                  <DateField.Group fullWidth>
                    <DateField.Input>
                      {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateField.Suffix>
                      <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                      </DatePicker.Trigger>
                    </DateField.Suffix>
                  </DateField.Group>
                  <DatePicker.Popover>
                    <Calendar aria-label="Created date">
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
                          {(day) => (
                            <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                          )}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>
                          {(date) => <Calendar.Cell date={date} />}
                        </Calendar.GridBody>
                      </Calendar.Grid>
                      <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                          {({ year }) => (
                            <Calendar.YearPickerCell
                              className="text-xs"
                              year={year}
                            />
                          )}
                        </Calendar.YearPickerGridBody>
                      </Calendar.YearPickerGrid>
                    </Calendar>
                  </DatePicker.Popover>
                </DatePicker>
              )}
            />
            {showUpdatedDate && (
              <Controller
                control={form.control}
                name="updatedAt"
                render={({ fieldState: { invalid }, field }) => (
                  <DatePicker
                    hideTimeZone
                    name="updatedAt"
                    className="w-full md:w-1/2"
                    onChange={(value) =>
                      field.onChange(dayjs(value?.toString()).valueOf())
                    }
                    isInvalid={invalid}
                    value={
                      field.value
                        ? parseAbsolute(
                            dayjs(field.value).toISOString(),
                            getLocalTimeZone()
                          )
                        : null
                    }>
                    <Label>Updated Date</Label>
                    <DateField.Group fullWidth>
                      <DateField.Input>
                        {(segment) => <DateField.Segment segment={segment} />}
                      </DateField.Input>
                      <DateField.Suffix>
                        <DatePicker.Trigger>
                          <DatePicker.TriggerIndicator />
                        </DatePicker.Trigger>
                      </DateField.Suffix>
                    </DateField.Group>
                    <DatePicker.Popover>
                      <Calendar aria-label="Updated date">
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
                            {(day) => (
                              <Calendar.HeaderCell>{day}</Calendar.HeaderCell>
                            )}
                          </Calendar.GridHeader>
                          <Calendar.GridBody>
                            {(date) => <Calendar.Cell date={date} />}
                          </Calendar.GridBody>
                        </Calendar.Grid>
                        <Calendar.YearPickerGrid>
                          <Calendar.YearPickerGridBody>
                            {({ year }) => (
                              <Calendar.YearPickerCell
                                className="text-xs"
                                year={year}
                              />
                            )}
                          </Calendar.YearPickerGridBody>
                        </Calendar.YearPickerGrid>
                      </Calendar>
                    </DatePicker.Popover>
                  </DatePicker>
                )}
              />
            )}
          </div>

          <div className="flex w-full items-end gap-2 md:w-1/2">
            <Controller
              control={form.control}
              name="contentType"
              render={({ fieldState, field }) => (
                <div className="flex w-1/2 flex-col gap-1">
                  <Label htmlFor={`${id}-contentType`}>Content Type</Label>
                  <Select
                    id={`${id}-contentType`}
                    value={field.value}
                    onChange={(key) => {
                      if (key) {
                        field.onChange(key);
                      }
                    }}
                    isDisabled={disabled || true}
                    isInvalid={fieldState.invalid}
                    placeholder="Select type">
                    <Select.Trigger>
                      <Select.Value />
                      <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                      <ListBox>
                        {CONTENT_TYPE_OPTIONS.map((item) => (
                          <ListBox.Item key={item.key} id={item.key}>
                            {item.label}
                          </ListBox.Item>
                        ))}
                      </ListBox>
                    </Select.Popover>
                  </Select>
                  {fieldState.error && (
                    <p className="px-1 text-xs text-red-500">
                      {fieldState.error.message}
                    </p>
                  )}
                </div>
              )}
            />
            <Controller
              control={form.control}
              name="published"
              render={({ field }) => (
                <div className="w-1/2">
                  <Switch
                    isSelected={Boolean(field.value)}
                    onChange={field.onChange}>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    <Label className="text-sm">Published</Label>
                  </Switch>
                </div>
              )}
            />
          </div>
        </div>

        <DefaultLocaleField />

        <LocaleTabs />

        <TitleField id={id} disabled={disabled} />

        <DescriptionField id={id} disabled={disabled} />
      </div>
    );
  }
);
