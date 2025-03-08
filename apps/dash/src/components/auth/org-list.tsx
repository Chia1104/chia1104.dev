"use client";

import { useTransition } from "react";

import { useTransitionRouter } from "next-view-transitions";

import type { Organization } from "@chia/auth/types";

import { setCurrentOrg } from "@/server/org.action";

import ProjectCard from "../projects/project-card";

const OrgList = ({ orgs }: { orgs: Organization[] }) => {
  const [isPending, startTransition] = useTransition();
  const router = useTransitionRouter();
  return (
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
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
