import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect, unauthorized } from "next/navigation";

import DashLayout from "@/components/commons/dash-layout";
import Footer from "@/components/commons/footer";
import { getSession, getFullOrganization } from "@/services/auth/resources.rsc";

export default async function Template({
  children,
  themeSwitch,
}: {
  children: ReactNode;
  themeSwitch: ReactNode;
}) {
  const session = await getSession();
  const cookieStore = await cookies();
  const currentOrg = cookieStore.get("currentOrg");

  if (!session.data) {
    unauthorized();
  }

  if (!currentOrg?.value) {
    redirect("/onboarding");
  }

  const org = await getFullOrganization(currentOrg.value);

  return (
    <DashLayout
      footer={<Footer inject={{ themeSwitch }} />}
      org={org.data?.name ?? "Chia1104.dev"}>
      {children}
    </DashLayout>
  );
}
