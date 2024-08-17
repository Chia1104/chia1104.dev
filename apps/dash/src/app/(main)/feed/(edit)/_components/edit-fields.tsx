"use client";

import { useRef, useState, forwardRef, useImperativeHandle, memo } from "react";

import { parseDate } from "@internationalized/date";
import MEditor from "@monaco-editor/react";
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
} from "@nextui-org/react";
import dayjs from "dayjs";
import { Callout } from "fumadocs-ui/components/callout";
import { Pencil, GalleryVerticalEnd } from "lucide-react";
import { useFormContext } from "react-hook-form";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { FeedType, ArticleType } from "@chia/db/types";
import Editor from "@chia/editor";
import { useTheme, ErrorBoundary } from "@chia/ui";
import { FormControl, FormField, FormItem, FormMessage, cn } from "@chia/ui";

import {
  EditFieldsContext,
  useEditFieldsContext,
  DEFAULT_EDIT_FIELDS_CONTEXT,
} from "./edit-fields.context";
import { useDraft } from "./use-draft";

interface Props {
  disabled?: boolean;
  isPending?: boolean;
  className?: string;
  mode?: "edit" | "create";
  token?: string;
}

export interface Ref {
  content: EditFieldsContext["content"];
  getContent: (type?: ArticleType | null) => {
    content: string;
    source: string;
  };
}

export const MetadataFields = () => {
  const form = useFormContext<CreateFeedInput>();
  const editFields = useEditFieldsContext();
  const articleType = useRef([
    { key: ArticleType.Mdx, label: ArticleType.Mdx.toUpperCase() },
    { key: ArticleType.Tiptap, label: ArticleType.Tiptap.toUpperCase() },
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
        {editFields.mode === "edit" && (
          <Button>
            <span className="text-xs">Delete</span>
          </Button>
        )}
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
                disabled={editFields.disabled}
                label="Slug"
                isInvalid={fieldState.invalid}
                description="The slug will automatically be generated based on the title."
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
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex flex-col md:flex-row w-full gap-5">
        <FormField<CreateFeedInput, "createdAt">
          control={form.control}
          name="createdAt"
          render={({ field, fieldState }) => (
            <FormItem className="w-full md:w-1/2">
              <FormControl>
                <DatePicker
                  isDisabled={editFields.disabled}
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
                    field.onChange(dayjs(date.toString()).toDate());
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                    checked={Boolean(field.value)}
                    onChange={field.onChange}>
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
  return (
    <>
      {form.watch("contentType") === ArticleType.Mdx ? (
        <Callout type="info">
          You are using the markdown editor. You can use markdown syntax to
          write your content.
          <Spacer />
          <Button variant="ghost" size="sm">
            Preview <span className="text-xs">(Coming soon)</span>
          </Button>
        </Callout>
      ) : (
        <Callout type="warn">
          You are using <strong className="font-bold">UNSTABLE</strong> Tiptap
          editor. Please be aware that this feature is still in development and
          may not work as expected.
          <Spacer />
          <Button variant="ghost" size="sm">
            Preview <span className="text-xs">(Coming soon)</span>
          </Button>
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
  return (
    <>
      {form.watch("contentType") === ArticleType.Mdx ? (
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-2xl shadow-lg",
            editFields.disabled && "pointer-events-none"
          )}>
          <MEditor
            className={cn("py-5 dark:bg-[#1e1e1e] bg-white")}
            height="700px"
            defaultLanguage="markdown"
            theme={isDarkMode ? "vs-dark" : "light"}
            loading={<Spinner />}
            onChange={(value) => {
              editFields.setContent((prev) => ({
                ...prev,
                [ArticleType.Mdx]: {
                  content: value ?? "",
                  source: value ?? "",
                },
              }));
              if (editFields.mode === "create" && editFields.token.length > 0) {
                setState({
                  content: {
                    [ArticleType.Mdx]: {
                      content: value ?? "",
                      source: value ?? "",
                    },
                  },
                });
              }
            }}
            value={
              editFields.content.mdx.content || getState().content?.mdx?.content
            }
          />
        </div>
      ) : (
        <Editor
          editable={!editFields.disabled}
          onUpdate={(e) => {
            const content = e.editor.storage.markdown.getMarkdown();
            const source = JSON.stringify(e.editor.getJSON());
            editFields.setContent((prev) => ({
              ...prev,
              [ArticleType.Tiptap]: {
                content,
                source,
              },
            }));
            if (editFields.mode === "create" && editFields.token.length > 0) {
              setState({
                content: {
                  [ArticleType.Tiptap]: {
                    content,
                    source,
                  },
                },
              });
            }
          }}
          className="min-h-[700px]"
          initialContent={JSON.parse(
            editFields.content.tiptap.source ||
              getState().content?.tiptap?.source ||
              "{}"
          )}
        />
      )}
    </>
  );
};

const Fields = forwardRef<Ref, Props>(({ mode = "create", ...props }, ref) => {
  useImperativeHandle(ref, () => ({
    content,
    getContent: (type) => {
      switch (type ?? form.watch("contentType")) {
        case ArticleType.Mdx:
          return {
            content: content.mdx.content,
            source: content.mdx.source,
          };
        case ArticleType.Tiptap:
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
  const [content, setContent] = useState(DEFAULT_EDIT_FIELDS_CONTEXT.content);

  return (
    <EditFieldsContext.Provider
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
    </EditFieldsContext.Provider>
  );
});

export default Fields;
