"use client";

import { useRouter } from "next/navigation";
import { useTransition, useCallback } from "react";

import {
  Button,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  TextField,
  FieldGroup,
  Fieldset,
  Separator,
} from "@heroui/react";
import type { FormProps } from "@heroui/react";
import { toast } from "sonner";

import { authClient } from "@chia/auth/client";
import { Provider } from "@chia/auth/types";
import SubmitForm from "@chia/ui/submit-form";

export function LoginForm(props: FormProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const getCurrentDomain = () => {
    return window.location.origin;
  };

  const onSubmit = useCallback(
    (formData: FormData) => {
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
              router.push("/auth/callback/sent-success");
            },
            onError: () => {
              toast.error("An error occurred, please try again");
            },
          }
        );
      });
    },
    [router]
  );

  const handleSocialLogin = useCallback((provider: Provider) => {
    startTransition(async () => {
      await authClient.signIn.social({
        provider,
        callbackURL: getCurrentDomain(),
      });
    });
  }, []);

  return (
    <Form {...props} action={onSubmit}>
      <Fieldset>
        <Fieldset.Legend>Login to your account</Fieldset.Legend>
        <Description>
          Enter your email below to login to your account
        </Description>
        <FieldGroup>
          <TextField isRequired name="email" type="email">
            <Label>Email</Label>
            <Input placeholder="m@example.com" />
            <FieldError />
          </TextField>
          <SubmitForm type="submit" fullWidth>
            Send magic link
          </SubmitForm>
          <span className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-sm">
              Or continue with
            </span>
            <Separator className="flex-1" />
          </span>
          <Fieldset.Actions className="flex flex-col gap-2">
            <Button
              variant="outline"
              type="button"
              fullWidth
              onPress={() => handleSocialLogin(Provider.github)}
              isPending={isPending}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path
                  d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
                  fill="currentColor"
                />
              </svg>
              Login with GitHub
            </Button>
            <Button
              variant="outline"
              type="button"
              fullWidth
              onPress={() => handleSocialLogin(Provider.google)}
              isPending={isPending}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="1em"
                height="1em"
                viewBox="0 0 256 262">
                <path
                  fill="#4285F4"
                  d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"></path>
                <path
                  fill="#34A853"
                  d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"></path>
                <path
                  fill="#FBBC05"
                  d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"></path>
                <path
                  fill="#EB4335"
                  d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"></path>
              </svg>
              Login with Google
            </Button>
          </Fieldset.Actions>
        </FieldGroup>
      </Fieldset>
    </Form>
  );
}
