"use client";

import { type FC } from "react";
import { Button, Link } from "@nextui-org/react";

const GoHome: FC = () => {
  return (
    <Button className="relative" size="lg" variant="flat" color="warning">
      Go to Home
      <Link
        href="/"
        rel="noopener noreferrer"
        className="absolute inset-0 w-full"
      />
    </Button>
  );
};

export default GoHome;
