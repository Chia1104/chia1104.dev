"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { memo, useId } from "react";

import {
  Input,
  TextArea,
  Tabs,
  Select,
  Switch,
  Spinner,
  Button,
  Skeleton,
  TextField,
  Label,
  FieldError,
  ListBox,
  Description,
  Calendar,
  DateField,
  DatePicker,
  AlertDialog,
} from "@heroui/react";
import { parseAbsolute, getLocalTimeZone } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, GalleryVerticalEnd } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";
import { toast } from "sonner";

import { FeedType, ContentType } from "@chia/db/types";
import { Locale } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import { useEditFields } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-[700px] w-full rounded-xl" />,
});

const CONTENT_TYPE_OPTIONS = [
  { key: ContentType.Mdx, label: ContentType.Mdx.toUpperCase() },
  { key: ContentType.Tiptap, label: ContentType.Tiptap.toUpperCase() },
] as const;

const FEED_TYPE_TABS = [
  { id: FeedType.Post, icon: GalleryVerticalEnd, label: "Post" },
  { id: FeedType.Note, icon: Pencil, label: "Note" },
] as const;

const SUPPORTED_LOCALES: { key: Locale; index: number; label: string }[] = [
  {
    key: Locale.En,
    index: 0,
    label: "English",
  },
  {
    key: Locale.zhTW,
    index: 1,
    label: "Chinese (Traditional)",
  },
];

const MONACO_OPTIONS = {
  minimap: { enabled: false },
  wordWrap: "on" as const,
  scrollBeyondLastLine: false,
  scrollbar: { vertical: "auto" as const },
  lineNumbers: "off" as const,
  quickSuggestions: false,
};

interface Props {
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  mode?: "edit" | "create";
  token?: string;
  feedId?: number;
}

const DeleteButton = memo(
  ({ feedId, type }: { feedId: number; type: FeedType }) => {
    const router = useRouter();
    const queryClient = useQueryClient();

    const deleteFeed = useMutation(
      orpc.feeds.delete.mutationOptions({
        onSuccess: async () => {
          toast.success("Feed deleted successfully");
          await queryClient.invalidateQueries(
            orpc.feeds.list.queryOptions({
              input: {
                type,
              },
            })
          );
          router.push(`/feed/${type}s`);
        },
        onError: (err) => {
          toast.error(err.message);
        },
      })
    );

    const handleDelete = () => {
      deleteFeed.mutate({ feedId });
    };

    return (
      <AlertDialog>
        <Button variant="danger">Delete</Button>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog className="sm:max-w-[400px]">
              <AlertDialog.CloseTrigger />
              <AlertDialog.Header>
                <AlertDialog.Icon status="danger" />
                <AlertDialog.Heading>
                  Delete feed permanently?
                </AlertDialog.Heading>
              </AlertDialog.Header>
              <AlertDialog.Body>
                <p>
                  This will permanently delete <strong>My Awesome Feed</strong>{" "}
                  and all of its data. This action cannot be undone.
                </p>
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button slot="close" variant="tertiary">
                  Cancel
                </Button>
                <Button onPress={handleDelete} variant="danger">
                  Delete Feed
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog>
    );
  }
);

DeleteButton.displayName = "DeleteButton";

const SlugField = memo(() => {
  const id = useId();
  const form = useFormContext<FormSchema>();
  const { disabled, mode } = useEditFields();

  const isFieldDisabled = disabled || mode === "edit";
  const showDescription = mode === "create";

  return (
    <Controller
      control={form.control}
      name="slug"
      render={({ field, fieldState: { invalid, error } }) => (
        <TextField isInvalid={invalid} fullWidth>
          <Label htmlFor={`${id}-slug`}>Slug</Label>
          <Input
            id={`${id}-slug`}
            disabled={isFieldDisabled}
            placeholder="slug"
            {...field}
          />
          <FieldError>{error?.message}</FieldError>
          {showDescription && (
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

SlugField.displayName = "SlugField";

const FeedTypeTabs = memo(() => {
  const form = useFormContext<FormSchema>();

  return (
    <Controller
      control={form.control}
      name="type"
      render={({ field }) => (
        <Tabs
          selectedKey={field.value}
          onSelectionChange={(key) => field.onChange(key)}>
          <Tabs.List aria-label="Feed type">
            {FEED_TYPE_TABS.map(({ id, icon: Icon, label }) => (
              <Tabs.Tab key={id} id={id}>
                <div className="flex items-center space-x-2">
                  <Icon className="size-5" />
                  <span>{label}</span>
                </div>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
    />
  );
});

FeedTypeTabs.displayName = "FeedTypeTabs";

const TitleField = memo(
  ({ id, disabled }: { id: string; disabled?: boolean }) => {
    const form = useFormContext<FormSchema>();
    const activeLocale = form.watch("activeLocale");

    return (
      <Controller
        key={activeLocale}
        control={form.control}
        name={`translations.${activeLocale}.title`}
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} isRequired fullWidth>
            <Label htmlFor={`${id}-title-${activeLocale}`}>Title</Label>
            <Input
              id={`${id}-title-${activeLocale}`}
              disabled={disabled}
              placeholder="Untitled"
              {...field}
            />
            <FieldError>{error?.message}</FieldError>
          </TextField>
        )}
      />
    );
  }
);

TitleField.displayName = "TitleField";

const DescriptionField = ({
  id,
  disabled,
}: {
  id: string;
  disabled?: boolean;
}) => {
  const form = useFormContext<FormSchema>();
  const activeLocale = form.watch("activeLocale");

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
          <TextArea
            id={`${id}-description-${activeLocale}`}
            disabled={disabled}
            placeholder="Enter description"
            rows={7}
            {...field}
            value={field.value ?? ""}
          />
          <FieldError>{error?.message}</FieldError>
        </TextField>
      )}
    />
  );
};

DescriptionField.displayName = "DescriptionField";

const LocaleTabs = memo(() => {
  const form = useFormContext<FormSchema>();

  return (
    <Controller
      control={form.control}
      name="activeLocale"
      render={({ field }) => (
        <Tabs selectedKey={field.value} onSelectionChange={field.onChange}>
          <Tabs.List aria-label="Locale">
            {SUPPORTED_LOCALES.map((locale) => (
              <Tabs.Tab key={locale.key} id={locale.key}>
                <span>{locale.label}</span>
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
    />
  );
});

LocaleTabs.displayName = "LocaleTabs";

export const MetadataFields = memo(({ feedId }: { feedId?: number }) => {
  const id = useId();
  const form = useFormContext<FormSchema>();
  const { disabled, mode } = useEditFields();

  const showDeleteButton = mode === "edit" && feedId;
  const showUpdatedDate = mode === "edit";

  return (
    <div className="flex w-full flex-col gap-5">
      <div className="flex items-center justify-between">
        <FeedTypeTabs />
        {showDeleteButton && feedId && (
          <DeleteButton feedId={feedId} type={form.watch("type")} />
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

      <LocaleTabs />

      <TitleField id={id} disabled={disabled} />

      <DescriptionField id={id} disabled={disabled} />
    </div>
  );
});

MetadataFields.displayName = "MetadataFields";

const SwitchEditor = memo(() => {
  const form = useFormContext<FormSchema>();
  const { disabled } = useEditFields();
  const { isDarkMode } = useTheme();

  const contentType = form.watch("contentType") ?? ContentType.Mdx;
  const activeLocale = form.watch("activeLocale");

  const editorTheme = isDarkMode ? "vs-dark" : "light";
  const editorClassName = cn("bg-white py-5 dark:bg-[#1e1e1e]");
  const containerClassName = cn(
    "relative w-full overflow-hidden rounded-2xl shadow-lg",
    disabled && "pointer-events-none"
  );

  return contentType !== ContentType.Mdx ? null : (
    <div className={containerClassName}>
      <Controller
        key={activeLocale}
        control={form.control}
        name={`translations.${activeLocale}.content.content`}
        render={({ field }) => (
          <MEditor
            className={editorClassName}
            height="700px"
            defaultLanguage="markdown"
            theme={editorTheme}
            loading={<Spinner />}
            onChange={(value) => field.onChange(value ?? "")}
            value={field.value ?? ""}
            options={MONACO_OPTIONS}
          />
        )}
      />
    </div>
  );
});

SwitchEditor.displayName = "SwitchEditor";

const Fields = (props: Props) => {
  return (
    <div className={cn("flex flex-col gap-10", props.className)}>
      <MetadataFields feedId={props.feedId} />
      <ErrorBoundary>
        <SwitchEditor />
      </ErrorBoundary>
    </div>
  );
};

Fields.displayName = "Fields";

export default Fields;
