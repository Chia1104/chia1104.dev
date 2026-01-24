import { notFound } from "next/navigation";

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
    <div className="flex w-full flex-col gap-5">
      <ApiKeyTable projectId={project.id} />
    </div>
  );
};

export default Page;
