"use client";

import { useEffect, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { createFeedSchema } from "@chia/api/trpc/validators";
import { FeedType, ContentType } from "@chia/db/types";
import { Form, SubmitForm } from "@chia/ui";

import { api } from "@/trpc/client";

import type { Ref } from "../_components/edit-fields";
import EditFields from "../_components/edit-fields";
import { useDraft } from "../_components/use-draft";

const CreateForm = ({
  type = FeedType.Post,
}: {
  type?: typeof FeedType.Note | typeof FeedType.Post;
}) => {
  const editFieldsRef = useRef<Ref>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useRef(searchParams.get("token") ?? crypto.randomUUID());
  const { getState, setState } = useDraft(token.current);
  const draft = useRef(getState().draft);
  const utils = api.useUtils();
  const create = api.feeds.createFeed.useMutation({
    async onSuccess(_data, { type }) {
      toast.success("Feed created successfully");
      router.push(`/feed/${type}s`);
      await utils.feeds.invalidate();
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const form = useForm<CreateFeedInput>({
    defaultValues: {
      contentType: ContentType.Mdx,
      type,
      title: "Untitled",
      ...draft.current,
      createdAt: draft.current?.createdAt
        ? dayjs(draft.current.createdAt).valueOf()
        : dayjs().valueOf(),
    },
    resolver: zodResolver(createFeedSchema),
  });

  const onSubmit = form.handleSubmit((values) => {
    create.mutate({
      ...values,
      content: editFieldsRef.current?.getContent(values.contentType).content,
      source: editFieldsRef.current?.getContent(values.contentType).source,
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
