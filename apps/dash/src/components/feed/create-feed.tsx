"use client";

import { Button } from "@heroui/react";
import { useTransitionRouter } from "next-view-transitions";

import { setSearchParams } from "@chia/utils";

const CreateFeed = () => {
  const router = useTransitionRouter();
  return (
    <Button
      onPress={() =>
        router.push(
          setSearchParams(
            {
              token: crypto.randomUUID(),
            },
            {
              baseUrl: "/feed/write",
            }
          )
        )
      }>
      Create
    </Button>
  );
};

export default CreateFeed;
