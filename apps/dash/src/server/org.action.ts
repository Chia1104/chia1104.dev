"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { action } from "./action";

export const setCurrentOrg = action
  .schema(z.string())
  .action(async ({ parsedInput }) => {
    const cookieStore = await cookies();
    cookieStore.set("currentOrg", parsedInput);
  });

export const revokeCurrentOrg = action.action(async () => {
  const cookieStore = await cookies();
  cookieStore.delete("currentOrg");
});
