"use client";

import {
  TextRevealCard,
  TextRevealCardDescription,
  TextRevealCardTitle,
} from "../../src/TextRevealCard";
import { withError } from "../../src/Error";
import { Button } from "@nextui-org/react";

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
          revealText="出事拉，阿北！"
          startCount={20}>
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
