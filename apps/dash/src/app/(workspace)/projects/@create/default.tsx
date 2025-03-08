"use client";

import { Card, CardHeader } from "@heroui/react";
import { useTransitionRouter } from "next-view-transitions";

import CreateForm from "@/components/projects/create-form";
import { useOrganizationStore } from "@/store/organization.store";
import { api } from "@/trpc/client";

const Default = () => {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const router = useTransitionRouter();
  const utils = api.useUtils();

  return (
    <Card className="w-full max-w-md self-center">
      <CardHeader className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </CardHeader>
      <CreateForm
        organizationId={currentOrgId}
        onSuccess={async () => {
          router.refresh();
          await utils.organization.getProjectsWithMeta.invalidate();
        }}
      />
    </Card>
  );
};

export default Default;
