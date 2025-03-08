import { notFound } from "next/navigation";

import { api } from "@/trpc/rsc";

const Page = async (props: { params: Promise<{ slug: string }> }) => {
  const { slug } = await props.params;
  const project = await api.organization.getProjectBySlug({
    slug,
  });
  if (!project) {
    notFound();
  }
  return <div>{project.name}</div>;
};

export default Page;
