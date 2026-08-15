"use client";

import { notFound, useParams } from "next/navigation";
import { ViewTransition } from "react";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import ApiKeyTable from "@/components/projects/api-key-table";
import { orpc } from "@/libs/orpc/client";

const Page = () => {
  const { slug } = useParams<{ slug: string }>();
  const { data: project, isLoading } = useQuery(
    orpc.organization.projects["details-by-slug"].queryOptions({
      input: { slug },
      retry: false,
    })
  );

  if (isLoading) return <Spinner size="md" />;
  if (!project) {
    notFound();
  }

  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4 px-4 py-8 md:px-6 lg:px-8">
        <ApiKeyTable projectId={project.id} />
      </section>
    </ViewTransition>
  );
};

export default Page;
