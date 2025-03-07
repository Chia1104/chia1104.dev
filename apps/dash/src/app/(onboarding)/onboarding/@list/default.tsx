import { notFound } from "next/navigation";

import OrgList from "@/components/auth/org-list";
import { listOrganizations } from "@/services/auth/resources.rsc";

const Default = async () => {
  const orgs = await listOrganizations();

  if (!orgs.data) {
    notFound();
  }

  return (
    <div className="w-full c-container py-20 prose dark:prose-invert">
      <h2>Welcome to your dashboard! Here are your available organizations:</h2>
      <div className="grid gap-5 grid-cols-1 md:grid-cols-2">
        <OrgList orgs={orgs.data} />
      </div>
    </div>
  );
};

export default Default;
