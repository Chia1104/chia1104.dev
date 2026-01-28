"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState, forwardRef, useImperativeHandle, memo, useId } from "react";
import { Controller, useFormContext } from "react-hook-form";

import {
  Input,
  TextArea,
  Tabs,
  DateInputGroup,
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
  DateField,
  AlertDialog,
} from "@heroui/react";
import { fromDate } from "@internationalized/date";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, GalleryVerticalEnd } from "lucide-react";
import { toast } from "sonner";

import type { feedsContracts } from "@chia/api/orpc/contracts";
import { FeedType, ContentType } from "@chia/db/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import { useEditFields } from "@/store/draft";
import type { ContentData, EditFieldsContext } from "@/store/draft";

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

export interface Ref {
  content: EditFieldsContext["content"];
  getContent: (type?: ContentType | null) => ContentData;
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
  const form = useFormContext<feedsContracts.CreateFeedInput>();
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
  const form = useFormContext<feedsContracts.CreateFeedInput>();

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
    const form = useFormContext<feedsContracts.CreateFeedInput>();

    return (
      <Controller
        control={form.control}
        name="translation.title"
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} isRequired fullWidth>
            <Label htmlFor={`${id}-title`}>Title</Label>
            <Input
              id={`${id}-title`}
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

const DescriptionField = memo(
  ({ id, disabled }: { id: string; disabled?: boolean }) => {
    const form = useFormContext<feedsContracts.CreateFeedInput>();

    return (
      <Controller
        control={form.control}
        name="translation.description"
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} fullWidth>
            <Label htmlFor={`${id}-description`}>Description</Label>
            <TextArea
              id={`${id}-description`}
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
  }
);

DescriptionField.displayName = "DescriptionField";

export const MetadataFields = memo(({ feedId }: { feedId?: number }) => {
  const id = useId();
  const form = useFormContext<feedsContracts.CreateFeedInput>();
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

      <TitleField id={id} disabled={disabled} />

      <SlugField />

      <DescriptionField id={id} disabled={disabled} />

      <div className="flex w-full flex-col gap-5 md:flex-row">
        <div className="flex w-full gap-5 md:w-1/2">
          <Controller
            control={form.control}
            name="createdAt"
            render={({ fieldState: { invalid, error }, field }) => (
              <DateField
                value={
                  field.value
                    ? fromDate(dayjs(field.value).toDate(), "UTC")
                    : null
                }
                onChange={(value) =>
                  field.onChange(dayjs(value?.toString()).valueOf())
                }
                isInvalid={invalid}
                fullWidth
                className={cn(showUpdatedDate ? "md:w-1/2" : "w-full")}>
                <Label htmlFor={`${id}-createdAt`}>Created Date</Label>
                <DateInputGroup id={`${id}-createdAt`}>
                  <DateInputGroup.Input>
                    {(segment) => <DateInputGroup.Segment segment={segment} />}
                  </DateInputGroup.Input>
                </DateInputGroup>
                <FieldError>{error?.message}</FieldError>
              </DateField>
            )}
          />
          {showUpdatedDate && (
            <Controller
              control={form.control}
              name="updatedAt"
              render={({ fieldState: { invalid, error }, field }) => (
                <DateField
                  value={
                    field.value
                      ? fromDate(dayjs(field.value).toDate(), "UTC")
                      : null
                  }
                  onChange={(value) =>
                    field.onChange(dayjs(value?.toString()).valueOf())
                  }
                  isInvalid={invalid}
                  fullWidth
                  className="md:w-1/2">
                  <Label htmlFor={`${id}-updatedAt`}>Updated Date</Label>
                  <DateInputGroup id={`${id}-updatedAt`}>
                    <DateInputGroup.Input>
                      {(segment) => (
                        <DateInputGroup.Segment segment={segment} />
                      )}
                    </DateInputGroup.Input>
                  </DateInputGroup>
                  <FieldError>{error?.message}</FieldError>
                </DateField>
              )}
            />
          )}
        </div>

        <div className="flex w-full items-end gap-5 md:w-1/2">
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
    </div>
  );
});

MetadataFields.displayName = "MetadataFields";

const SwitchEditor = memo(() => {
  const form = useFormContext<feedsContracts.CreateFeedInput>();
  const { disabled } = useEditFields();
  const { isDarkMode } = useTheme();

  const contentType = form.watch("contentType") ?? ContentType.Mdx;

  const editorTheme = isDarkMode ? "vs-dark" : "light";
  const editorClassName = cn("bg-white py-5 dark:bg-[#1e1e1e]");
  const containerClassName = cn(
    "relative w-full overflow-hidden rounded-2xl shadow-lg",
    disabled && "pointer-events-none"
  );

  return contentType !== ContentType.Mdx ? null : (
    <div className={containerClassName}>
      <Controller
        control={form.control}
        name="content.content"
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

const Fields = forwardRef<Ref, Props>(({ mode = "create", ...props }, ref) => {
  const form = useFormContext<feedsContracts.CreateFeedInput>();
  const {
    content,
    setMode,
    setDisabled,
    setIsPending,
    setContent: setStoreContent,
    getContent,
  } = useEditFields();

  useState(() => {
    setMode(mode);
    if (props.disabled !== undefined) {
      setDisabled(props.disabled);
    }
    if (props.isPending !== undefined) {
      setIsPending(props.isPending);
    }
  });

  useState(() => {
    const contentType = form.getValues("contentType");
    if (!contentType) return;

    const formContent = form.getValues("content.content") ?? "";
    const formSource = form.getValues("content.source") ?? "";

    if (contentType === ContentType.Mdx) {
      setStoreContent({
        [ContentType.Mdx]: {
          content: formContent,
          source: formSource,
        },
      });
    } else if (contentType === ContentType.Tiptap) {
      setStoreContent({
        [ContentType.Tiptap]: {
          content: formContent,
          source: formSource,
        },
      });
    }
  });

  useImperativeHandle(
    ref,
    () => ({
      content,
      getContent: (type) => {
        const currentType = type ?? form.watch("contentType");
        if (
          currentType === ContentType.Mdx ||
          currentType === ContentType.Tiptap
        ) {
          return getContent(currentType);
        }
        return getContent(ContentType.Mdx);
      },
    }),
    [content, form, getContent]
  );

  return (
    <div className={cn("flex flex-col gap-10", props.className)}>
      <MetadataFields feedId={props.feedId} />
      <ErrorBoundary>
        <SwitchEditor />
      </ErrorBoundary>
    </div>
  );
});

Fields.displayName = "Fields";

export default Fields;
