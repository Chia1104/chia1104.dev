"use client";

import { Button, Code } from "@heroui/react";
import { useRouter } from "next/navigation";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/text-reveal-card";

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="main container">
      <TextRevealCard text="404 Not Found" revealText="出事拉，阿北！">
        <TextRevealCardTitle>Not Found</TextRevealCardTitle>
        <TextRevealCardDescription>
          Sorry, the page you are looking for does not exist.
        </TextRevealCardDescription>
        <Button onPress={() => router.push("/")} className="mt-5">
          <Code>cd ../</Code>
        </Button>
      </TextRevealCard>
    </div>
  );
}
