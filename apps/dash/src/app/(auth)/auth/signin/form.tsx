"use client";

import { useTransition } from "react";

import { Input, Divider, Button } from "@nextui-org/react";

import { Provider } from "@chia/auth-core/types";
import { Card, SubmitForm } from "@chia/ui";

import { signInAction } from "@/server/auth.action";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[500px]",
      }}
      className="prose dark:prose-invert flex w-full max-w-[500px] flex-col items-center justify-center px-1 py-12 sm:px-4">
      <h3>Create an account</h3>
      <p className="mb-10 text-center text-xs">
        Enter your email below to create your account
      </p>
      <form
        className="flex w-4/5 flex-col gap-2"
        action={(e) =>
          startTransition(() =>
            signInAction({
              provider: Provider.resend,
              redirectTo: "/",
              formData: e,
            })
          )
        }>
        <Input
          isRequired
          required
          disabled={isPending}
          placeholder="Email"
          type="email"
          name="email"
          className="w-full"
        />
        <SubmitForm
          variant="flat"
          color="primary"
          className="w-full"
          isLoading={isPending}>
          Sign in with email
        </SubmitForm>
      </form>
      <Divider className="mb-3 mt-7 w-4/5" />
      <p className="text-center text-xs">Or sign in with social media</p>
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
