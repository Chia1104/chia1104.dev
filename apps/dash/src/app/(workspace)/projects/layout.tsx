"use client";

import { useSelectedLayoutSegments } from "next/navigation";

import AppLoading from "@/components/commons/app-loading";
import ProjectLayout from "@/components/projects/project-layout";
import { useOrganizationStore } from "@/store/organization.store";
import { api } from "@/trpc/client";

const Layout = ({
  children,
  list,
  create,
}: {
  children: React.ReactNode;
  list: React.ReactNode;
  create: React.ReactNode;
}) => {
  const segments = useSelectedLayoutSegments();
  const { currentOrgId } = useOrganizationStore((state) => state);
  const { data, isLoading } = api.organization.getProjectsWithMeta.useQuery({
    organizationId: currentOrgId,
  });

  if (isLoading || !data?.items)
    return (
      <ProjectLayout>
        <AppLoading />
      </ProjectLayout>
    );

  if (data.items.length > 0 && segments.length === 0) {
    return <ProjectLayout>{list}</ProjectLayout>;
  } else if (data.items.length === 0 && segments.length === 0) {
    return <ProjectLayout>{create}</ProjectLayout>;
  }

  return <ProjectLayout>{children}</ProjectLayout>;
};

export default Layout;
