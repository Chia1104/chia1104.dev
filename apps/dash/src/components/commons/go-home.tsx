"use client";

import { useRouter } from "next/navigation";
import type { FC } from "react";

import { Button } from "@heroui/react";

const GoHome: FC = () => {
  const router = useRouter();
  return (
    <Button
      className="relative"
      size="lg"
      variant="tertiary"
      onPress={() => router.push("/")}>
      Go to Home
    </Button>
  );
};

export default GoHome;
