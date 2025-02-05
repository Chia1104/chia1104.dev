"use server";

import { createAuthClient } from "better-auth/client";

import { signIn, signOut } from "@chia/auth";
import { Provider } from "@chia/auth-core/types";
import { getServiceEndPoint } from "@chia/utils";

type SignInOptions =
  | {
      provider?: typeof Provider.google | typeof Provider.github;
      redirectTo?: string;
    }
  | {
      provider: typeof Provider.resend;
      redirectTo?: string;
      formData: FormData;
    };

const betterAuthClient = createAuthClient();

export const signInAction = async (options?: SignInOptions) => {
  options ??= { provider: Provider.google };
  const { provider, redirectTo = "/" } = options;
  switch (provider) {
    default:
    case Provider.google:
      await signIn(Provider.google, {
        redirect: true,
        redirectTo,
        callbackUrl: "/",
      });
      break;
    case Provider.github:
      await signIn(Provider.github, {
        redirect: true,
        redirectTo,
        callbackUrl: "/",
      });
      break;
    case Provider.resend:
      await signIn(Provider.resend, options.formData);
      break;
  }
};

export const signOutAction = async () => await signOut();

export const betterAuthGoogleSignIn = async () => {
  await betterAuthClient.signIn.social({
    provider: "google",
  });
};
