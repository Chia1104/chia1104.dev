import type { ReactNode } from "react";

import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import "server-only";

import { authClient } from "@chia/auth/client";

import DashLayout from "@/components/commons/dash-layout";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  if (!session.data) {
    unauthorized();
  }
  return <DashLayout>{children}</DashLayout>;
}
