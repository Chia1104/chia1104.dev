"use client";

import type { ReactNode } from "react";

import { cn } from "@chia/ui/utils/cn.util";

import { useOrganizationStore } from "@/store/organization.store";

const ProjectLayout = ({ children }: { children: ReactNode }) => {
  const { currentOrgSlug } = useOrganizationStore((state) => state);
  return (
    <>
      <nav className="w-full h-20 c-bg-third absolute inset-0 flex flex-col justify-center px-10">
        <h2 className="text-xl font-bold">{currentOrgSlug}</h2>
      </nav>
      <section
        className={cn("c-container main justify-start items-start mt-10")}>
        {children}
      </section>
    </>
  );
};

export default ProjectLayout;
