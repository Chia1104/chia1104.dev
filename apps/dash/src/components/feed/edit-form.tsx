"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useForm, FormProvider } from "react-hook-form";

import { Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { feedsContracts } from "@chia/api/orpc/contracts";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { orpc } from "@/libs/orpc/client";

import EditFields from "./edit-fields";

const cloneFormData = <T,>(data: T): T => {
  return JSON.parse(JSON.stringify(data));
};

interface EditFormProps {
  defaultValues: Partial<feedsContracts.CreateFeedInput>;
  feedId: number;
}

const EditForm = ({ defaultValues, feedId }: EditFormProps) => {
  const queryClient = useQueryClient();
  const router = useRouter();

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
      ...cloneFormData(defaultValues),
      createdAt: defaultValues?.createdAt
        ? dayjs(defaultValues.createdAt).valueOf()
        : dayjs().valueOf(),
      updatedAt: dayjs().valueOf(),
    },
    resolver: zodResolver(feedsContracts.createFeedSchema),
  });

  const onSubmit = useCallback(
    (values: feedsContracts.CreateFeedInput) => {
      update.mutate({
        feedId,
        type: values.type,
        published: values.published,
        contentType: values.contentType,
        createdAt: values.createdAt,
        updatedAt: values.updatedAt,
        translation: values.translation,
        content: {
          content: values.content?.content,
          source: values.content?.source,
        },
      });
    },
    [update, feedId]
  );

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-10">
        <EditFields
          disabled={update.isPending}
          isPending={update.isPending}
          mode="edit"
          feedId={feedId}
        />
        <SubmitForm
          className="w-full max-w-[150px]"
          isPending={update.isPending}>
          Update
        </SubmitForm>
      </Form>
    </FormProvider>
  );
};

export default EditForm;
