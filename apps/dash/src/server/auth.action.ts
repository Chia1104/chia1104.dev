"use server";

import { signIn, signOut } from "@chia/auth";
import { Provider } from "@chia/auth-core/types";

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
      const formData = options.formData;
      await signIn(Provider.resend, formData);
      break;
  }
};

export const signOutAction = () => signOut();
