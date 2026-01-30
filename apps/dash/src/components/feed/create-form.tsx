"use client";

import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useForm, FormProvider } from "react-hook-form";

import { Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { FeedType, ContentType } from "@chia/db/types";
import { Locale } from "@chia/db/types";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";
import { useDraft } from "@/store/draft";
import type { FormSchema } from "@/store/draft/slices/edit-fields";
import { formSchema } from "@/store/draft/slices/edit-fields";

import EditFields from "./edit-fields";

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

  const { saveDraft, draft } = useDraft(token);

  const formData = useMemo(() => draft?.formData ?? {}, [draft]);

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

  const form = useForm<FormSchema>({
    defaultValues: {
      contentType: ContentType.Mdx,
      type,
      defaultLocale: Locale.zhTW,
      activeLocale: Locale.zhTW,
      ...formData,
      translations: {
        [Locale.zhTW]: {
          title: "Untitled",
          excerpt: null,
          description: null,
          summary: null,
          readTime: null,
          ...formData?.translations?.[Locale.zhTW],
        },
        [Locale.En]: {
          title: "Untitled",
          excerpt: null,
          description: null,
          summary: null,
          readTime: null,
          ...formData?.translations?.[Locale.En],
        },
      },
      createdAt: formData?.createdAt
        ? dayjs(formData.createdAt).valueOf()
        : dayjs().valueOf(),
    },
    resolver: zodResolver(formSchema),
  });

  const debouncedSaveRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSave = useCallback(
    (formData: Partial<FormSchema>) => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }

      debouncedSaveRef.current = setTimeout(() => {
        try {
          saveDraft(structuredClone(formData));
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
        <SubmitForm className="w-full max-w-37.5" isPending={create.isPending}>
          Create
        </SubmitForm>
      </Form>
    </FormProvider>
  );
};

export default CreateForm;
