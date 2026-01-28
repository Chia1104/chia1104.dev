"use client";

import { useTransitionRouter } from "next-view-transitions";
import { useTransition } from "react";

import type { Organization } from "@chia/auth/types";

import { setCurrentOrg } from "@/server/org.action";

import ProjectCard from "../projects/project-card";

const OrgList = ({ orgs }: { orgs: Organization[] }) => {
  const [isPending, startTransition] = useTransition();
  const router = useTransitionRouter();
  return (
    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {orgs.map((org) => (
        <ProjectCard
          isDisabled={isPending}
          onPress={() => {
            startTransition(async () => {
              await setCurrentOrg(org.slug);
              router.push(`/projects`);
            });
          }}
          key={org.id}
          name={org.name}
          slug={org.slug}
          image={org.logo}
        />
      ))}
    </div>
  );
};

export default OrgList;
