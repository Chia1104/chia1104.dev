"use client";

import { useRouter } from "next/navigation";
import { useTransition, useCallback } from "react";

import type { Organization } from "@chia/auth/types";

import { setCurrentOrg } from "@/server/org.action";

import Card from "../commons/card";

const OrgList = ({ orgs }: { orgs: Organization[] }) => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleOrgSelect = useCallback(
    (slug: string) => {
      startTransition(async () => {
        await setCurrentOrg(slug);
        router.push("/");
      });
    },
    [router]
  );

  return (
    <div className="grid w-full grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
      {orgs.map((org) => (
        <Card
          key={org.id}
          title={org.name}
          description={org.slug}
          imageSrc={org.logo}
          imageAlt={`${org.name} logo`}
          onPress={() => handleOrgSelect(org.slug)}
          isDisabled={isPending}
        />
      ))}
    </div>
  );
};

export default OrgList;
