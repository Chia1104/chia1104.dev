"use client";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/TextRevealCard";
import { Button, Link, Code } from "@nextui-org/react";

export default function NotFound() {
  return (
    <div className="main c-container">
      <TextRevealCard
        text="404 Not Found"
        revealText="出事拉，阿北！"
        startCount={20}>
        <TextRevealCardTitle>Not Found</TextRevealCardTitle>
        <TextRevealCardDescription>
          Sorry, the page you are looking for does not exist.
        </TextRevealCardDescription>
        <Button as={Link} href="/" className="mt-5">
          <Code>cd ../</Code>
        </Button>
      </TextRevealCard>
    </div>
  );
}
