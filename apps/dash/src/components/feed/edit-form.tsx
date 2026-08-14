"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, FormProvider } from "react-hook-form";
import { toast } from "sonner";

import { Locale } from "@chia/db/types";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import type { EmbeddingResource } from "@/components/rag/embedding-drawer";
import { orpc } from "@/libs/orpc/client";
import { DraftProvider } from "@/store/draft";
import { formSchema } from "@/store/draft/slices/edit-fields";
import type { FormSchema } from "@/store/draft/slices/edit-fields";

import { EditFields } from "./edit-fields";
import type { MetaChipProps } from "./meta-chip";

export interface EditFormProps {
  defaultValues: Partial<FormSchema>;
  feedId: number;
  meta?: MetaChipProps;
  /** Translation ids, which the embedding drawer indexes by. */
  resources?: EmbeddingResource[];
}

const EditForm = ({
  defaultValues,
  feedId,
  meta,
  resources,
}: EditFormProps) => {
  const queryClient = useQueryClient();
  const router = useRouter();

  const update = useMutation(
    orpc.feeds.update.mutationOptions({
      async onSuccess(_data, { type }) {
        toast.success("Feed updated successfully");
        router.push(`/feed/${type}s`);
        await queryClient.invalidateQueries({
          queryKey: orpc.feeds.list.key(),
        });
      },
      onError(err) {
        toast.error(err.message);
      },
    })
  );

  const form = useForm<FormSchema>({
    defaultValues: {
      ...defaultValues,
      activeLocale: defaultValues?.defaultLocale ?? Locale.zhTW,
      createdAt: defaultValues?.createdAt
        ? dayjs(defaultValues.createdAt).valueOf()
        : dayjs().valueOf(),
      updatedAt: dayjs().valueOf(),
    },
    resolver: zodResolver(formSchema),
  });

  const onSubmit = useCallback(
    (values: FormSchema) => {
      update.mutate({
        ...values,
        feedId,
      });
    },
    [update, feedId]
  );

  const handleSubmit = form.handleSubmit(onSubmit);

  return (
    <DraftProvider
      initialValues={{
        mode: "edit",
      }}>
      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="flex w-full flex-col gap-10">
          <EditFields
            disabled={update.isPending}
            isPending={update.isPending}
            mode="edit"
            feedId={feedId}
            meta={meta}
            resources={resources}
          />
          <SubmitForm
            className="w-full max-w-[150px]"
            isPending={update.isPending}>
            Update
          </SubmitForm>
        </Form>
      </FormProvider>
    </DraftProvider>
  );
};

export default EditForm;
