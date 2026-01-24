"use client";

import { useSelectedLayoutSegments } from "next/navigation";

import { useQuery } from "@tanstack/react-query";

import AppLoading from "@/components/commons/app-loading";
import ProjectLayout from "@/components/projects/project-layout";
import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

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

  const { data, isLoading } = useQuery(
    orpc.organization.projects.list.queryOptions({
      input: {
        organizationId: currentOrgId,
      },
    })
  );

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
