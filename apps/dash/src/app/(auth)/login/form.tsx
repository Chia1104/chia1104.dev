"use client";

import { signIn } from "next-auth/react";
import { Card, Image } from "ui";
import { Button } from "@nextui-org/react";
import { useTransition } from "react";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  return (
    <Card>
      <p className="mt-5">Sign In</p>
      <Image src="/logo.png" alt="chia1104" width={150} height={150} />
      <Button
        disabled={isPending}
        variant="flat"
        color="primary"
        size="xl"
        className="mb-5 mt-auto"
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
