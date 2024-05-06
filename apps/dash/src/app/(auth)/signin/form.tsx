"use client";

import { signInAction } from "@/server/auth.action";
import { Card, SubmitForm } from "@chia/ui";
import { Provider } from "@chia/auth-core/types";
import { Input, Divider, Button } from "@nextui-org/react";
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
      <form
        className="flex w-4/5 flex-col gap-2"
        action={(e) =>
          signInAction({
            provider: Provider.resend,
            redirectTo: "/",
            formData: e,
          })
        }>
        <Input
          placeholder="Email"
          type="email"
          name="email"
          className="w-full"
        />
        <SubmitForm variant="flat" color="primary" className="w-full">
          Login
        </SubmitForm>
      </form>
      <Divider className="my-7 w-4/5" />
      <div className="flex w-full justify-center gap-5">
        <Button
          onPress={() =>
            startTransition(() =>
              signInAction({
                provider: Provider.google,
                redirectTo: "/",
              })
            )
          }
          isLoading={isPending}
          variant="flat"
          color="primary"
          isIconOnly
          className="mb-5 mt-auto h-12 w-1/3 p-2">
          <span className="i-mdi-google size-7" />
        </Button>
        <Button
          onPress={() =>
            startTransition(() =>
              signInAction({
                provider: Provider.github,
                redirectTo: "/",
              })
            )
          }
          isLoading={isPending}
          variant="flat"
          color="primary"
          isIconOnly
          className="mb-5 mt-auto h-12 w-1/3 p-2">
          <span className="i-mdi-github size-7" />
        </Button>
      </div>
    </Card>
  );
};

export default LoginForm;
