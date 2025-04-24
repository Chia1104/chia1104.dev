import { notFound } from "next/navigation";

import ApiKeyTable from "@/components/projects/api-key-table";
import { api } from "@/trpc/rsc";

const Page = async (props: { params: Promise<{ slug: string }> }) => {
  const { slug } = await props.params;
  const project = await api.organization.getProjectBySlug({
    slug,
  });
  if (!project) {
    notFound();
  }
  return (
    <div className="w-full flex flex-col gap-5">
      <ApiKeyTable projectId={project.id} />
    </div>
  );
};

export default Page;
