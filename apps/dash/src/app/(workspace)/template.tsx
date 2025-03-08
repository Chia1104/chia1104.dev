import { cookies } from "next/headers";

import { getFullOrganization } from "@/services/auth/resources.rsc";
import { OrganizationStoreProvider } from "@/store/organization.store";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const currentOrgSlug = cookieStore.get("currentOrg");

  if (!currentOrgSlug) {
    return null;
  }

  const org = await getFullOrganization(currentOrgSlug.value);

  return (
    <OrganizationStoreProvider
      values={{
        currentOrgSlug: currentOrgSlug.value,
        currentOrgId: org.data?.id,
        currentOrgName: org.data?.name,
      }}>
      {children}
    </OrganizationStoreProvider>
  );
}
