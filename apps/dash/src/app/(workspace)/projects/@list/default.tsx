"use client";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import ProjectCard from "@/components/projects/project-card";
import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

const Default = () => {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const { data, isLoading } = useQuery(
    orpc.organization.projects.list.queryOptions({
      input: {
        organizationId: currentOrgId,
        limit: 20,
      },
    })
  );
  if (isLoading) return <Spinner size="md" />;
  return (
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 w-full">
      {data?.items.map((item) =>
        item.slug ? (
          <ProjectCard
            key={item.id}
            name={item.name}
            image={item.logo}
            description={item.slug}
            slug={item.slug}
          />
        ) : null
      )}
    </div>
  );
};

export default Default;
