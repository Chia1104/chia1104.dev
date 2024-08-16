"use client";

import { Button } from "@nextui-org/react";
import { toast } from "sonner";

import { FeedType } from "@chia/db/types";

import { api } from "@/trpc/client";

const CreateTest = ({ type = FeedType.Post }: { type?: FeedType }) => {
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

  return (
    <Button
      onPress={() =>
        create.mutate({
          slug: crypto.randomUUID(),
          title: "Test",
          description: "Test",
          content: "Test",
          type,
        })
      }
      isLoading={create.isPending}>
      create test
    </Button>
  );
};

export default CreateTest;
