"use client";

import { useRef, useState, forwardRef, useImperativeHandle, memo } from "react";

import { parseDate } from "@internationalized/date";
import {
  Input,
  Textarea,
  Tabs,
  Tab,
  DatePicker,
  Select,
  SelectItem,
  Switch,
  Spinner,
  Spacer,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Skeleton,
} from "@nextui-org/react";
import dayjs from "dayjs";
import { Callout } from "fumadocs-ui/components/callout";
import { Pencil, GalleryVerticalEnd } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useFormContext } from "react-hook-form";
import { toast } from "sonner";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { FeedType, ContentType } from "@chia/db/types";
import { useTheme, ErrorBoundary } from "@chia/ui";
import { FormControl, FormField, FormItem, FormMessage, cn } from "@chia/ui";

import { api } from "@/trpc/client";

import {
  EditFieldsContext,
  useEditFieldsContext,
  DEFAULT_EDIT_FIELDS_CONTEXT,
} from "./edit-fields.context";
import {
  GenerateFeedSlug,
  GenerateFeedDescription,
  GenerateFeedContent,
} from "./generate";
import Preview from "./preview";
import { useDraft } from "./use-draft";

const MEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <Skeleton className="min-h-[700px] w-full rounded-xl" />,
});

// const Novel = dynamic(() => import("@chia/editor/novel"), {
//   ssr: false,
//   loading: () => <Skeleton className="min-h-[700px] w-full rounded-xl" />,
// });

interface Props {
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  mode?: "edit" | "create";
  token?: string;
}

export interface Ref {
  content: EditFieldsContext["content"];
  getContent: (type?: ContentType | null) => {
    content: string;
    source: string;
  };
}

const DeleteButton = () => {
  const form = useFormContext<CreateFeedInput>();
  const router = useRouter();
  const utils = api.useUtils();
  const deleteFeed = api.feeds.deleteFeed.useMutation({
    onSuccess: async () => {
      toast.success("Feed deleted successfully");
      await utils.feeds.invalidate();
      router.push("/feed/posts");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  return (
    <Popover backdrop="blur">
      <PopoverTrigger>
        <Button isLoading={deleteFeed.isPending} color="danger" variant="flat">
          <span className="text-xs">Delete</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-4 gap-3">
        <div className="text-small font-bold">
          Are you sure you want to delete this feed?
        </div>
        <Button
          isLoading={deleteFeed.isPending}
          color="danger"
          variant="flat"
          onPress={() =>
            deleteFeed.mutate({
              feedId: Number(form.getValues("id")),
            })
          }>
          <span className="text-xs">Delete</span>
        </Button>
      </PopoverContent>
    </Popover>
  );
};

export const MetadataFields = () => {
  const form = useFormContext<CreateFeedInput>();
  const editFields = useEditFieldsContext();
  const articleType = useRef([
    { key: ContentType.Mdx, label: ContentType.Mdx.toUpperCase() },
    { key: ContentType.Tiptap, label: ContentType.Tiptap.toUpperCase() },
  ]);
  const [contentType, setContentType] = useState(
    new Set([form.getValues("contentType")])
  );
  return (
    <div className="w-full flex flex-col gap-5">
      <div className="flex justify-between">
        <FormField<CreateFeedInput, "type">
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <Tabs
                  isDisabled={editFields.disabled}
                  selectedKey={field.value}
                  onSelectionChange={(value) => field.onChange(value)}
                  aria-label="feed type"
                  color="secondary"
                  size="sm">
                  <Tab
                    key={FeedType.Post}
                    title={
                      <div className="flex items-center space-x-2">
                        <GalleryVerticalEnd className="size-5" />
                        <span>Post</span>
                      </div>
                    }
                  />
                  <Tab
                    key={FeedType.Note}
                    title={
                      <div className="flex items-center space-x-2">
                        <Pencil className="size-5" />
                        <span>Note</span>
                      </div>
                    }
                  />
                </Tabs>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {editFields.mode === "edit" && <DeleteButton />}
      </div>
      <FormField<CreateFeedInput, "title">
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormControl>
              <Input
                disabled={editFields.disabled}
                label="Title *"
                labelPlacement="outside"
                placeholder="Untitled"
                isInvalid={fieldState.invalid}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField<CreateFeedInput, "slug">
        control={form.control}
        name="slug"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormControl>
              <Input
                disabled={editFields.disabled || editFields.mode === "edit"}
                label="Slug"
                isInvalid={fieldState.invalid}
                description="The slug will automatically be generated based on the title.(slug can't be changed after creation)"
                endContent={
                  <GenerateFeedSlug
                    title={form.watch("title")}
                    onSuccess={(data) => {
                      field.onChange(data);
                    }}
                  />
                }
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField<CreateFeedInput, "description">
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormControl>
              <Textarea
                disabled={editFields.disabled}
                label="Description"
                labelPlacement="outside"
                placeholder="Description"
                minRows={7}
                isInvalid={fieldState.invalid}
                endContent={
                  <GenerateFeedDescription
                    input={form.watch("title")}
                    onSuccess={(data) => {
                      field.onChange(data);
                    }}
                  />
                }
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex flex-col md:flex-row w-full gap-5">
        <div className="flex gap-5 w-full md:w-1/2">
          <FormField<CreateFeedInput, "createdAt">
            control={form.control}
            name="createdAt"
            render={({ field, fieldState }) => (
              <FormItem
                className={cn(editFields.mode === "edit" ? "w-1/2" : "w-full")}>
                <FormControl>
                  <DatePicker
                    isInvalid={fieldState.invalid}
                    labelPlacement="outside"
                    className="w-full"
                    label="Create"
                    value={
                      field.value
                        ? parseDate(
                            dayjs(field.value).format(
                              // ISO 8601 date string, with no time
                              "YYYY-MM-DD"
                            )
                          )
                        : null
                    }
                    onChange={(date) => {
                      field.onChange(dayjs(date?.toString()).valueOf());
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {editFields.mode === "edit" && (
            <FormField<CreateFeedInput, "updatedAt">
              control={form.control}
              name="updatedAt"
              render={({ field, fieldState }) => (
                <FormItem className="w-1/2">
                  <FormControl>
                    <DatePicker
                      isInvalid={fieldState.invalid}
                      labelPlacement="outside"
                      className="w-full"
                      label="Update"
                      value={
                        field.value
                          ? parseDate(
                              dayjs(field.value).format(
                                // ISO 8601 date string, with no time
                                "YYYY-MM-DD"
                              )
                            )
                          : null
                      }
                      onChange={(date) => {
                        field.onChange(dayjs(date?.toString()).valueOf());
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        <div className="flex gap-5 items-end w-full md:w-1/2">
          <FormField<CreateFeedInput, "contentType">
            control={form.control}
            name="contentType"
            render={({ fieldState, field }) => (
              <FormItem className="w-1/2">
                <FormControl>
                  <Select
                    // @ts-expect-error - why Set ??
                    selectedKeys={contentType}
                    // @ts-expect-error - why Set ??
                    onSelectionChange={setContentType}
                    disabled={editFields.disabled}
                    isInvalid={fieldState.invalid}
                    items={articleType.current}
                    onChange={(value) => {
                      field.onChange(value);
                    }}
                    isDisabled
                    defaultSelectedKeys={[ContentType.Mdx]}
                    label="Content Type"
                    placeholder="Select a type"
                    labelPlacement="outside"
                    className="w-full">
                    {(item) => (
                      <SelectItem key={item.key}>{item.label}</SelectItem>
                    )}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField<CreateFeedInput, "published">
            control={form.control}
            name="published"
            render={({ field }) => (
              <FormItem className="w-1/2">
                <FormControl>
                  <Switch
                    disabled={editFields.disabled}
                    color="secondary"
                    isSelected={Boolean(field.value)}
                    onValueChange={field.onChange}>
                    Published
                  </Switch>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </div>
  );
};

const EditorInfo = memo(() => {
  const form = useFormContext<CreateFeedInput>();
  const editFields = useEditFieldsContext();
  return (
    <>
      {form.watch("contentType") !== ContentType.Tiptap ? (
        <Callout type="info">
          You are using the markdown editor. You can use markdown syntax to
          write your content. <br />
          Currently, the preview feature is only available for basic markdown
          syntax
          <Spacer />
          <Preview content={editFields.content.mdx.content} />
        </Callout>
      ) : (
        <Callout type="warn">
          You are using <strong className="font-bold">UNSTABLE</strong> Tiptap
          editor. Please be aware that this feature is still in development and
          may not work as expected.
        </Callout>
      )}
    </>
  );
});

const SwitchEditor = () => {
  const form = useFormContext<CreateFeedInput>();
  const editFields = useEditFieldsContext();
  const { isDarkMode } = useTheme();
  const { setState, getState } = useDraft(editFields.token);

  const editorCreator = (contentType: ContentType) => {
    switch (contentType) {
      case ContentType.Mdx:
        return (
          <div
            className={cn(
              "relative w-full overflow-hidden rounded-2xl shadow-lg",
              editFields.disabled && "pointer-events-none"
            )}>
            <GenerateFeedContent
              className="absolute top-3 right-3 z-30"
              input={{
                title: form.watch("title"),
                description: form.watch("description") ?? "",
                content: editFields.content.mdx.content,
              }}
              onSuccess={(data) => {
                console.log(data);
              }}
            />
            <MEditor
              className={cn("py-5 dark:bg-[#1e1e1e] bg-white")}
              height="700px"
              defaultLanguage="markdown"
              theme={isDarkMode ? "vs-dark" : "light"}
              loading={<Spinner />}
              onChange={(value) => {
                editFields.setContent((prev) => ({
                  ...prev,
                  [ContentType.Mdx]: {
                    content: value ?? "",
                    source: value ?? "",
                  },
                }));
                if (
                  editFields.mode === "create" &&
                  editFields.token.length > 0
                ) {
                  setState({
                    content: {
                      [ContentType.Mdx]: {
                        content: value ?? "",
                        source: value ?? "",
                      },
                    },
                  });
                }
              }}
              value={
                editFields.content.mdx.content ||
                getState().content?.mdx?.content
              }
              options={{
                minimap: { enabled: false },
                wordWrap: "on",
                scrollBeyondLastLine: false,
                scrollbar: { vertical: "auto" },
                lineNumbers: "off",
              }}
            />
          </div>
        );
      // case ContentType.Tiptap:
      //   return (
      //     <Novel
      //       editable={!editFields.disabled}
      //       onUpdate={(e) => {
      //         const content = e.editor.storage.markdown.getMarkdown();
      //         const source = JSON.stringify(e.editor.getJSON());
      //         editFields.setContent((prev) => ({
      //           ...prev,
      //           [ContentType.Tiptap]: {
      //             content,
      //             source,
      //           },
      //         }));
      //         if (editFields.mode === "create" && editFields.token.length > 0) {
      //           setState({
      //             content: {
      //               [ContentType.Tiptap]: {
      //                 content,
      //                 source,
      //               },
      //             },
      //           });
      //         }
      //       }}
      //       className="min-h-[700px]"
      //       initialContent={JSON.parse(
      //         editFields.content.tiptap.source ||
      //           getState().content?.tiptap?.source ||
      //           "{}"
      //       )}
      //     />
      //   );
      default:
        return null;
    }
  };

  return <>{editorCreator(form.watch("contentType") ?? ContentType.Mdx)}</>;
};

const Fields = forwardRef<Ref, Props>(({ mode = "create", ...props }, ref) => {
  useImperativeHandle(ref, () => ({
    content,
    getContent: (type) => {
      switch (type ?? form.watch("contentType")) {
        case ContentType.Mdx:
          return {
            content: content.mdx.content,
            source: content.mdx.source,
          };
        case ContentType.Tiptap:
          return {
            content: content.tiptap.content,
            source: content.tiptap.source,
          };
        default:
          return {
            content: "",
            source: "",
          };
      }
    },
  }));
  const form = useFormContext<CreateFeedInput>();

  const createDefaultContent = () => {
    const contentType = form.getValues("contentType");
    if (!contentType) {
      return DEFAULT_EDIT_FIELDS_CONTEXT.content;
    }
    switch (contentType) {
      case ContentType.Mdx:
        return {
          mdx: {
            content: form.getValues("content") ?? "",
            source: form.getValues("source") ?? "",
          },
          tiptap: {
            content: "",
            source: "",
          },
        };
      case ContentType.Tiptap:
        return {
          mdx: {
            content: "",
            source: "",
          },
          tiptap: {
            content: form.getValues("content") ?? "",
            source: form.getValues("source") ?? "",
          },
        };
      default:
        return DEFAULT_EDIT_FIELDS_CONTEXT.content;
    }
  };

  const [content, setContent] = useState(createDefaultContent());

  return (
    <EditFieldsContext
      value={{
        isPending: props.isPending,
        disabled: props.disabled,
        content,
        setContent,
        mode,
        token: props.token ?? "",
      }}>
      <div className={cn("flex flex-col", props.className)}>
        <MetadataFields />
        <EditorInfo />
        <ErrorBoundary>
          <SwitchEditor />
        </ErrorBoundary>
      </div>
    </EditFieldsContext>
  );
});

export default Fields;
