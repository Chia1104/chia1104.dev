import { redirect } from "next/navigation";
import { ViewTransition } from "react";

import { Description } from "@heroui/react";
import { all } from "better-all";

import OrgList from "@/components/auth/org-list";
import { listOrganizations, getSession } from "@/services/auth/resources.rsc";

const Page = async () => {
  const { orgs, session } = await all({
    orgs: () => listOrganizations(),
    session: () => getSession(),
  });

  if (!orgs.data || !session.data) {
    redirect("/onboarding/create");
  }

  return (
    <ViewTransition>
      <section className="flex w-full flex-col gap-4">
        <h1 className="text-2xl font-bold">Welcome {session.data.user.name}</h1>
        <Description>
          You are a member of multiple organizations. Please select one to
          continue.
        </Description>
        <OrgList orgs={orgs.data} />
      </section>
    </ViewTransition>
  );
};

export default Page;
