import { notFound } from "next/navigation";

import OrgList from "@/components/auth/org-list";
import { AcmeIcon } from "@/components/commons/acme";
import { listOrganizations } from "@/services/auth/resources.rsc";

const Default = async () => {
  const orgs = await listOrganizations();

  if (!orgs.data) {
    notFound();
  }

  return (
    <div className="prose dark:prose-invert min-w-full px-8 py-20">
      <div className="bg-foreground flex h-20 w-20 items-center justify-center rounded-full">
        <AcmeIcon size={56} className="text-background" />
      </div>
      <h2>Welcome to your dashboard! Here are your available organizations:</h2>
      <OrgList orgs={orgs.data} />
    </div>
  );
};

export default Default;
