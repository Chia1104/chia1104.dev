"use client";

import { useTransitionRouter } from "next-view-transitions";

import { Button } from "@heroui/react";

import { setSearchParams } from "@chia/utils/request";

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
