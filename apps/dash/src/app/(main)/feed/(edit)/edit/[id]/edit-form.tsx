"use client";

import { useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { createFeedSchema } from "@chia/api/trpc/validators";
import { Form, SubmitForm } from "@chia/ui";

import { api } from "@/trpc/client";

import type { Ref } from "../../_components/edit-fields";
import EditFields from "../../_components/edit-fields";

const EditForm = ({
  defaultValues,
  feedId,
}: {
  defaultValues: Partial<CreateFeedInput>;
  feedId: number;
}) => {
  const editFieldsRef = useRef<Ref>(null);
  const router = useRouter();
  const utils = api.useUtils();
  const update = api.feeds.updateFeed.useMutation({
    async onSuccess(_data, { type }) {
      toast.success("Feed updated successfully");
      router.push(`/feed/${type}s`);
      await utils.feeds.invalidate();
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const form = useForm<CreateFeedInput>({
    defaultValues: {
      ...defaultValues,
      createdAt: defaultValues?.createdAt
        ? dayjs(defaultValues.createdAt).valueOf()
        : dayjs().valueOf(),
      updatedAt: defaultValues?.updatedAt
        ? dayjs(defaultValues.updatedAt).valueOf()
        : dayjs().valueOf(),
    },
    resolver: zodResolver(createFeedSchema),
  });

  const onSubmit = form.handleSubmit((values) => {
    update.mutate({
      ...values,
      feedId,
      content: editFieldsRef.current?.getContent(values.contentType).content,
      source: editFieldsRef.current?.getContent(values.contentType).source,
    });
  });

  return (
    <Form {...form}>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[700px] flex flex-col gap-10">
        <EditFields ref={editFieldsRef} mode="edit" />
        <SubmitForm className="max-w-[150px] w-full">Update</SubmitForm>
      </form>
    </Form>
  );
};

export default EditForm;
