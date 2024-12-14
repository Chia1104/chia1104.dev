"use client";

import { Button, Code } from "@nextui-org/react";
import { useRouter } from "next/navigation";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/text-reveal-card";

export default function Component() {
  const router = useRouter();
  return (
    <div className="main c-container">
      <TextRevealCard revealText="Coming Soon" text="即將推出">
        <TextRevealCardTitle>Coming Soon</TextRevealCardTitle>
        <TextRevealCardDescription>
          This feature is coming soon.
        </TextRevealCardDescription>
        <Button onPress={() => router.push("/")} className="mt-5">
          <Code>cd ../</Code>
        </Button>
      </TextRevealCard>
    </div>
  );
}
