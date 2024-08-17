"use client";

import { useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { createFeedSchema } from "@chia/api/trpc/validators";
import { FeedType, ArticleType } from "@chia/db/types";
import { Form, SubmitForm } from "@chia/ui";

import { api } from "@/trpc/client";

import type { Ref } from "../_components/edit-fields";
import EditFields from "../_components/edit-fields";

const CreateForm = ({ type = FeedType.Post }: { type?: FeedType }) => {
  const editFieldsRef = useRef<Ref>(null);
  const utils = api.useUtils();
  const create = api.feeds.createFeed.useMutation({
    async onSuccess() {
      toast.success("Test created");
      await utils.feeds.invalidate();
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const form = useForm<CreateFeedInput>({
    defaultValues: {
      type,
      createdAt: dayjs().toDate(),
      contentType: ArticleType.Mdx,
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

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[700px] flex flex-col gap-10">
        <EditFields
          ref={editFieldsRef}
          disabled={create.isPending}
          isPending={create.isPending}
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
