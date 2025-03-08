"use client";

import { useTransition } from "react";

import { Card, CardBody, CardHeader } from "@heroui/react";
import { useTransitionRouter } from "next-view-transitions";

import type { Organization } from "@chia/auth/types";

import { setCurrentOrg } from "@/server/org.action";

const OrgItem = ({ org }: { org: Organization }) => {
  const [isPending, startTransition] = useTransition();
  const router = useTransitionRouter();
  return (
    <Card
      isDisabled={isPending}
      className="dark:bg-dark/90 grid-cols-1"
      isPressable
      onPress={() => {
        startTransition(async () => {
          await setCurrentOrg(org.slug);
          router.push(`/projects`);
        });
      }}>
      <CardHeader>
        <h4
          className="font-medium text-large line-clamp-2"
          style={{
            viewTransitionName: `view-transition-link-${org.id}`,
          }}>
          {org.name}
        </h4>
      </CardHeader>
      <CardBody className="gap-2">
        <p className="text-tiny font-bold mt-auto line-clamp-2">{org.slug}</p>
      </CardBody>
    </Card>
  );
};

const OrgList = ({ orgs }: { orgs: Organization[] }) => {
  return (
    <div className="grid gap-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 w-full">
      {orgs.map((org) => (
        <OrgItem key={org.id} org={org} />
      ))}
    </div>
  );
};

export default OrgList;
