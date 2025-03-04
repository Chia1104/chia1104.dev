"use client";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

import { setSearchParams } from "@chia/utils";

const CreateFeed = () => {
  const router = useRouter();
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
