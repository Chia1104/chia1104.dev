"use client";

import { Spinner } from "@heroui/react";

import ProjectLayout from "@/components/projects/project-layout";
import { useOrganizationStore } from "@/store/organization.store";
import { api } from "@/trpc/client";

const Layout = ({
  children: _children,
  list,
  create,
}: {
  children: React.ReactNode;
  list: React.ReactNode;
  create: React.ReactNode;
}) => {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const { data, isLoading } = api.organization.getProjectsWithMeta.useQuery({
    organizationId: currentOrgId,
  });

  if (isLoading || !data?.items)
    return (
      <ProjectLayout>
        <Spinner />
      </ProjectLayout>
    );

  if (data.items.length > 0) {
    return <ProjectLayout>{list}</ProjectLayout>;
  } else {
    return <ProjectLayout>{create}</ProjectLayout>;
  }
};

export default Layout;
