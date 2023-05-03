"use client";

import { signIn } from "next-auth/react";
import { Card } from "ui";
import { Button } from "@nextui-org/react";
import { useTransition } from "react";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  return (
    <Card>
      <p className="mt-5">Sign In</p>
      <Button
        disabled={isPending}
        color="neutral"
        size="xl"
        className="mb-20 mt-auto"
        onPress={() =>
          startTransition(() => {
            signIn("google", { redirect: true, callbackUrl: "/" });
          })
        }>
        Sign in with Google
      </Button>
    </Card>
  );
};

export default LoginForm;
