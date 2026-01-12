"use client";

import { useEffect, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTransitionRouter as useRouter } from "next-view-transitions";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { FeedType, ContentType } from "@chia/db/types";
import { Form } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { useDraft } from "@/hooks/use-draft";
import { orpc } from "@/libs/orpc/client";

import type { Ref } from "./edit-fields";
import EditFields from "./edit-fields";

const CreateForm = ({
  type = FeedType.Post,
}: {
  type?: typeof FeedType.Note | typeof FeedType.Post;
}) => {
  const queryClient = useQueryClient();
  const editFieldsRef = useRef<Ref>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useRef(searchParams.get("token") ?? crypto.randomUUID());
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { getState, setState } = useDraft(token.current);
  const draft = useRef(getState().draft);
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
      ...draft.current,
      createdAt: draft.current?.createdAt
        ? dayjs(draft.current.createdAt).valueOf()
        : dayjs().valueOf(),
    },
    resolver: zodResolver(feedsContracts.createFeedSchema),
  });

  const onSubmit = form.handleSubmit((values) => {
    const editorContent = editFieldsRef.current?.getContent(values.contentType);
    create.mutate({
      ...values,
      content: editorContent?.content
        ? {
            content: editorContent.content,
            source: editorContent.source,
          }
        : undefined,
    });
  });

  useEffect(() => {
    setState({
      draft: form.getValues(),
    });
  }, [form, form.getValues, setState]);

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[700px] flex flex-col gap-10">
        <EditFields
          ref={editFieldsRef}
          disabled={create.isPending}
          isPending={create.isPending}
          token={token.current}
          mode="create"
        />
        <SubmitForm
          className="max-w-[150px] w-full"
          disabled={create.isPending}>
          Create
        </SubmitForm>
      </form>
    </Form>
  );
};

export default CreateForm;
