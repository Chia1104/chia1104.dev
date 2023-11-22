"use client";

import { signInAction } from "@/server/auth.action";
import { Card, Image } from "@chia/ui";
import { Button } from "@nextui-org/react";
import { useTransition } from "react";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[500px]",
      }}
      className="prose dark:prose-invert flex w-full max-w-[500px] flex-col items-center justify-center p-5">
      <h1 className="">Sign In</h1>
      <Image src="/logo.png" alt="chia1104" width={150} height={150} />
      <Button
        disabled={isPending}
        variant="flat"
        color="primary"
        size="lg"
        className="mb-5 mt-auto"
        onPress={() => startTransition(() => signInAction())}>
        Sign in with Google
      </Button>
    </Card>
  );
};

export default LoginForm;
