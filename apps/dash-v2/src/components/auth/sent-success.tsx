"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { Button } from "@heroui/react";

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@chia/ui/empty";

import { Logo } from "../commons/logo";

export function SentSuccess() {
  const router = useRouter();

  const handleLogin = useCallback(() => {
    router.push("/auth/login");
  }, [router]);

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="default">
          <Logo />
        </EmptyMedia>
        <EmptyTitle>Check your email</EmptyTitle>
        <EmptyDescription>
          We've sent you an email with a link to login to your account.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" fullWidth onPress={handleLogin}>
          Back to Login
        </Button>
      </EmptyContent>
    </Empty>
  );
}
