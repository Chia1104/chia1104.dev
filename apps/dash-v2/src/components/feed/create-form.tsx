"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";

import { Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { FeedType, ContentType } from "@chia/db/types";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import { useDraft } from "@/store/draft";

import EditFields from "./edit-fields";

// Helper function to deep clone form data to avoid readonly property issues
const cloneFormData = <T,>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

interface CreateFormProps {
  type?: typeof FeedType.Note | typeof FeedType.Post;
}

const CreateForm = ({ type = FeedType.Post }: CreateFormProps) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token] = useState(
    () => searchParams.get("token") ?? crypto.randomUUID()
  );

  const { draft, saveDraft } = useDraft(token);

  const create = useMutation(
    orpc.feeds.create.mutationOptions({
      async onSuccess(_data, { type }) {
        toast.success("Feed created successfully");
        router.push(`/feed/${type}s`);
        await queryClient.invalidateQueries(orpc.feeds.list.queryOptions());
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  const form = useForm<feedsContracts.CreateFeedInput>({
    defaultValues: {
      contentType: ContentType.Mdx,
      type,
      defaultLocale: "zh-TW",
      translation: {
        locale: "zh-TW",
        title: "Untitled",
        excerpt: null,
        description: null,
        summary: null,
        readTime: null,
      },
      ...(draft?.formData ? cloneFormData(draft.formData) : {}),
      createdAt: draft?.formData?.createdAt
        ? dayjs(draft.formData.createdAt).valueOf()
        : dayjs().valueOf(),
    },
    resolver: zodResolver(feedsContracts.createFeedSchema),
  });

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (formData: Partial<feedsContracts.CreateFeedInput>) => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }

      debouncedSaveRef.current = setTimeout(() => {
        try {
          const clonedData = cloneFormData(formData);

          saveDraft(clonedData, {
            [ContentType.Mdx]: {
              content: clonedData.content?.content ?? "",
              source: clonedData.content?.source ?? "",
            },
            [ContentType.Tiptap]: {
              content: "",
              source: "",
            },
          });
        } catch (error) {
          console.error("Failed to save draft:", error);
        }
      }, 1000);
    },
    [saveDraft]
  );

  useEffect(() => {
    const subscription = form.watch(() => {
      const formData = form.getValues();
      debouncedSave(formData);
    });

    return () => {
      subscription.unsubscribe();
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, [form, debouncedSave]);

  const handleSubmit = form.handleSubmit((values) => {
    create.mutate(values);
  });

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-10">
        <EditFields
          disabled={create.isPending}
          isPending={create.isPending}
          token={token}
          mode="create"
        />
        <SubmitForm
          className="w-full max-w-[150px]"
          isPending={create.isPending}>
          Create
        </SubmitForm>
      </Form>
    </FormProvider>
  );
};

export default CreateForm;
