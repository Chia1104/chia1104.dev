"use client";

import type { FC } from "react";

import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";

const GoHome: FC = () => {
  const router = useRouter();
  return (
    <Button
      className="relative"
      size="lg"
      variant="flat"
      color="warning"
      onPress={() => router.push("/")}>
      Go to Home
    </Button>
  );
};

export default GoHome;
