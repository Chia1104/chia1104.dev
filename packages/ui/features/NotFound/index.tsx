"use client";

import Link from "next/link";
import { ViewTransition } from "react";

import { Button } from "@heroui/react";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/text-reveal-card";

export default function NotFound() {
  return (
    <ViewTransition>
      <div className="main not-prose container">
        <TextRevealCard text="404 Not Found" revealText="出事拉，阿北！">
          <TextRevealCardTitle>Not Found</TextRevealCardTitle>
          <TextRevealCardDescription>
            Sorry, the page you are looking for does not exist.
          </TextRevealCardDescription>
          <Link href="/">
            <Button className="mt-5">cd ../</Button>
          </Link>
        </TextRevealCard>
      </div>
    </ViewTransition>
  );
}
