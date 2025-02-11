"use client";

import { useTransition } from "react";

import { Input, Divider, Button } from "@heroui/react";
import { Icon } from "@iconify/react";
import { KeyRoundIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@chia/auth/client";
import { Provider } from "@chia/auth/types";
import Card from "@chia/ui/card";
import SubmitForm from "@chia/ui/submit-form";

const LoginForm = () => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const getCurrentDomain = () => {
    return window.location.origin;
  };

  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[500px]",
      }}
      className="prose dark:prose-invert flex w-full max-w-[500px] flex-col items-center justify-center px-1 py-12 sm:px-4">
      <h3>Sign in to your account</h3>
      <p className="mb-10 text-center text-xs">to continue to Chia1104.dev</p>
      <form
        className="flex w-4/5 flex-col gap-2"
        action={(formData) =>
          startTransition(async () => {
            const email = formData.get("email");
            if (!email) return;
            await authClient.signIn.magicLink(
              {
                email: email as string,
                callbackURL: getCurrentDomain(),
              },
              {
                onSuccess: () => {
                  toast.success("Check your email for the magic link");
                },
                onError: () => {
                  toast.error("An error occurred, please try again");
                },
              }
            );
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
          variant="flat"
          color="primary"
          className="w-full"
          isLoading={isPending}>
          Send magic link
        </SubmitForm>
      </form>
      <div className="flex items-center gap-4 w-4/5">
        <Divider className="flex-1" />
        <p className="shrink-0 text-tiny text-default-500 mb-0">OR</p>
        <Divider className="flex-1" />
      </div>
      <Button
        className="w-4/5"
        startContent={<KeyRoundIcon />}
        variant="flat"
        color="primary"
        onPress={() =>
          startTransition(() => {
            void authClient.signIn.passkey(undefined, {
              onSuccess: () => {
                toast.success("Logged in successfully");
                router.refresh();
              },
              onError: () => {
                toast.error("An error occurred, please try again");
              },
            });
          })
        }>
        Sign in with a passkey
      </Button>
      <div className="flex w-4/5 justify-center gap-5 my-5">
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
          className="mb-5 mt-auto h-12 w-1/2 p-2">
          <Icon icon="flat-color-icons:google" width={28} />
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
          className="mb-5 mt-auto h-12 w-1/2 p-2">
          <span className="i-mdi-github size-7" />
        </Button>
      </div>
    </Card>
  );
};

export default LoginForm;
