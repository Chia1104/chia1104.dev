"use server";

import { signIn, signOut } from "@chia/auth";

export const signInAction = (redirectTo?: string) =>
  signIn("google", {
    redirect: true,
    redirectTo,
    callbackUrl: "/",
  });

export const signOutAction = () => signOut();
