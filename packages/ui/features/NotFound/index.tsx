"use client";

import { ViewTransition } from "react";

import { Button, Code } from "@heroui/react";
import Link from "next/link";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/text-reveal-card";

export default function NotFound() {
  return (
    <ViewTransition>
      <div className="main container not-prose">
        <TextRevealCard text="404 Not Found" revealText="出事拉，阿北！">
          <TextRevealCardTitle>Not Found</TextRevealCardTitle>
          <TextRevealCardDescription>
            Sorry, the page you are looking for does not exist.
          </TextRevealCardDescription>
          <Link href="/">
            <Button className="mt-5">
              <Code>cd ../</Code>
            </Button>
          </Link>
        </TextRevealCard>
      </div>
    </ViewTransition>
  );
}
