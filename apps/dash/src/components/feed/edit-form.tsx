"use client";

import { useRef, useTransition } from "react";

import { Button, Tooltip } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Bubbles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { CreateFeedInput } from "@chia/api/trpc/validators";
import { createFeedSchema } from "@chia/api/trpc/validators";
import { Form } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import dayjs from "@chia/utils/day";

import { api } from "@/trpc/client";

import type { Ref } from "./edit-fields";
import EditFields from "./edit-fields";

const EditForm = ({
  defaultValues,
  feedId,
}: {
  defaultValues: Partial<CreateFeedInput>;
  feedId: number;
}) => {
  const [isGenerating] = useTransition();
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
      updatedAt: dayjs().valueOf(),
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
        <section className="flex justify-start gap-2 self-start">
          <Tooltip content="Generate Embedding (Experimental)">
            <Button
              size="sm"
              isIconOnly
              color="warning"
              className="bg-warning-200 text-warning"
              isLoading={isGenerating}
              // onPress={() =>
              //   startTransition(async () => {
              //     const result = await generateFeedEmbedding({
              //       feedID: feedId.toString(),
              //     });
              //     if (
              //       result?.serverError ||
              //       result?.validationErrors ||
              //       result?.bindArgsValidationErrors
              //     ) {
              //       console.error(result);
              //       toast.error("Failed to generate embedding");
              //     } else {
              //       toast.success("Embedding generated successfully");
              //     }
              //   })
              // }
            >
              <Bubbles className="text-warning size-4" />
            </Button>
          </Tooltip>
        </section>
        <EditFields ref={editFieldsRef} mode="edit" />
        <SubmitForm className="max-w-[150px] w-full">Update</SubmitForm>
      </form>
    </Form>
  );
};

export default EditForm;
