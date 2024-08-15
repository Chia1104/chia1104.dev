"use client";

import { useTransition } from "react";

import { Button } from "@nextui-org/react";
import { toast } from "sonner";

import { FeedType } from "@chia/db/types";

import { api } from "@/trpc-api";

const CreateTest = ({ type = FeedType.Post }: { type?: FeedType }) => {
  const create = api.feeds.createFeed.useMutation({
    onSuccess() {
      toast.success("Test created");
    },
    onError(err) {
      toast.error(err.message);
    },
  });
  const [isPending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      await create.mutateAsync({
        slug: crypto.randomUUID(),
        title: "Test",
        description: "Test",
        content: "Test",
        type,
      });
    });

  return (
    <Button onPress={() => submit()} isLoading={isPending}>
      create test
    </Button>
  );
};

export default CreateTest;
