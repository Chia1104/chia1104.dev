import { notFound } from "next/navigation";
import { ViewTransition } from "react";

import ApiKeyTable from "@/components/projects/api-key-table";
import { client } from "@/libs/orpc/client";

export const dynamic = "force-dynamic";

const Page = async (props: { params: Promise<{ slug: string }> }) => {
  const { slug } = await props.params;
  const project = await client.organization.projects["details-by-slug"]({
    slug,
  });
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
