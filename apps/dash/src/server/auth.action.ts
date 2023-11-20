"use server";

import { signIn, signOut } from "@chia/auth";

export const signInAction = () =>
  signIn("google", {
    redirect: true,
    callbackUrl: "/",
  });

export const signOutAction = signOut;
