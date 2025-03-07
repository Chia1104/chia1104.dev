import type { ReactNode } from "react";

import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { authClient } from "@chia/auth/client";

import DashLayout from "@/components/commons/dash-layout";
import Footer from "@/components/commons/footer";

export default async function Layout({
  children,
  themeSwitch,
  params,
}: {
  children: ReactNode;
  themeSwitch: ReactNode;
  params: Promise<{ org: string }>;
}) {
  const parsedParams = await params;

  const org = await authClient.organization.getFullOrganization({
    fetchOptions: {
      headers: await headers(),
    },
    query: {
      organizationSlug: parsedParams.org,
    },
  });

  if (org.error || !org.data) {
    notFound();
  }

  return (
    <DashLayout
      footer={<Footer inject={{ themeSwitch }} />}
      org={org.data.name}>
      {children}
    </DashLayout>
  );
}
