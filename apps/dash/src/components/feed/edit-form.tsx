"use client";

import { useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { feedsContracts } from "@chia/api/orpc/contracts";
import { Form } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";

import type { Ref } from "./edit-fields";
import EditFields from "./edit-fields";

const EditForm = ({
  defaultValues,
  feedId,
}: {
  defaultValues: Partial<feedsContracts.CreateFeedInput>;
  feedId: number;
}) => {
  const editFieldsRef = useRef<Ref>(null);
  const router = useRouter();
  const queryClient = useQueryClient();
  const update = useMutation(
    orpc.feeds.update.mutationOptions({
      async onSuccess(_data, { type }) {
        toast.success("Feed updated successfully");
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
      ...defaultValues,
      createdAt: defaultValues?.createdAt
        ? dayjs(defaultValues.createdAt).valueOf()
        : dayjs().valueOf(),
      updatedAt: dayjs().valueOf(),
    },
    resolver: zodResolver(feedsContracts.createFeedSchema),
  });

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    form.handleSubmit((values) => {
      const content = editFieldsRef.current?.getContent(values.contentType);
      update.mutate({
        feedId,
        type: values.type,
        published: values.published,
        contentType: values.contentType,
        createdAt: values.createdAt,
        updatedAt: values.updatedAt,
        translation: values.translation,
        content: {
          content: content?.content,
          source: content?.source,
        },
      });
    })(e);

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
