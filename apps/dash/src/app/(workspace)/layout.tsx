import type { ReactNode } from "react";

import { cookies } from "next/headers";
import { redirect, unauthorized } from "next/navigation";

import DashLayout from "@/components/commons/dash-layout";
import Footer from "@/components/commons/footer";
import { getSession, getFullOrganization } from "@/services/auth/resources.rsc";
import { OrganizationStoreProvider } from "@/store/organization.store";

export default async function Layout({
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

  return (
    <DashLayout
      footer={<Footer inject={{ themeSwitch }} />}
      org={
        (await getFullOrganization(currentOrg.value)).data?.name ??
        "Chia1104.dev"
      }>
      <OrganizationStoreProvider
        values={{
          currentOrgSlug: currentOrg.value,
        }}>
        {children}
      </OrganizationStoreProvider>
    </DashLayout>
  );
}
