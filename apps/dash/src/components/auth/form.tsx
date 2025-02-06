"use client";

import { useTransition } from "react";

import { Input, Divider, Button } from "@heroui/react";

import { authClient } from "@chia/auth/client";
import { Provider } from "@chia/auth/types";
import Card from "@chia/ui/card";
import SubmitForm from "@chia/ui/submit-form";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  const getCurrentDomain = () => {
    return window.location.origin;
  };
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
        action={(formData) =>
          startTransition(async () => {
            const email = formData.get("email");
            if (!email) return;
            await authClient.signIn.magicLink({
              email: email as string,
              callbackURL: getCurrentDomain(),
            });
          })
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
          /**
           * TODO: fix the drizzle schema
           */
          isDisabled
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
            startTransition(async () => {
              await authClient.signIn.social({
                provider: Provider.google,
                callbackURL: getCurrentDomain(),
              });
            })
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
            startTransition(async () => {
              await authClient.signIn.social({
                provider: Provider.github,
                callbackURL: getCurrentDomain(),
              });
            })
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
