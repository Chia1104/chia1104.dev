import { ViewTransition } from "react";

import * as z from "zod";

import { LoginForm } from "@/components/auth/login-form";

/** A repeated or malformed `error` is dropped rather than shown. */
const searchParamsSchema = z.object({
  error: z.string().optional().catch(undefined),
});

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = searchParamsSchema.parse(await searchParams);
  return (
    <ViewTransition>
      <LoginForm error={error} />
    </ViewTransition>
  );
}
