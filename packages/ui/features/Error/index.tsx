"use client";

import { Button } from "@heroui/react";

import { withError } from "../../hoc/with-error";
import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/text-reveal-card";

const Error = ({
  onError,
  className,
}: {
  onError?: (error: Error) => void;
  className?: string;
}) =>
  withError(
    ({ reset }) => {
      return (
        <TextRevealCard
          className={className}
          text="500"
          revealText="出事拉，阿北！">
          <TextRevealCardTitle>Oops, something went wrong!</TextRevealCardTitle>
          <TextRevealCardDescription>
            We are sorry, but something went wrong. Please try again later.
          </TextRevealCardDescription>
          <Button className="mt-5" onPress={reset}>
            Try again
          </Button>
        </TextRevealCard>
      );
    },
    {
      onError,
    }
  );

export default Error;
