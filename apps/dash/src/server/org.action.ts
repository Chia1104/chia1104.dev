"use server";

import { cookies } from "next/headers";

import * as z from "zod";

import { getCookieDomain } from "@chia/auth/utils";

import { env } from "@/env";

import { action } from "./action";

export const setCurrentOrg = action
  .inputSchema(z.string())
  .action(async ({ parsedInput }) => {
    const cookieStore = await cookies();
    cookieStore.set("currentOrg", parsedInput, {
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      domain: getCookieDomain({ env }),
    });
  });

export const revokeCurrentOrg = action.action(async () => {
  const cookieStore = await cookies();
  cookieStore.delete("currentOrg");
});
