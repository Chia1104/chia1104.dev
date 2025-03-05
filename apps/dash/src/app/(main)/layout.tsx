import type { ReactNode } from "react";
import { unstable_ViewTransition as ViewTransition } from "react";

import { headers } from "next/headers";
import { unauthorized } from "next/navigation";
import "server-only";

import { authClient } from "@chia/auth/client";

import DashLayout from "@/components/commons/dash-layout";
import Footer from "@/components/commons/footer";

export default async function Layout({
  children,
  themeSwitch,
}: {
  children: ReactNode;
  themeSwitch: ReactNode;
}) {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  if (!session.data) {
    unauthorized();
  }
  return (
    <DashLayout footer={<Footer inject={{ themeSwitch }} />}>
      <ViewTransition>{children}</ViewTransition>
    </DashLayout>
  );
}
