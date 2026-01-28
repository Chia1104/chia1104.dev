"use client";

import { useTransitionRouter } from "next-view-transitions";

import { Card, CardHeader } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";

import CreateForm from "@/components/projects/create-form";
import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

const Default = () => {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const router = useTransitionRouter();
  const queryClient = useQueryClient();
  return (
    <Card className="w-full max-w-md self-center">
      <CardHeader className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold">Create New Project</h1>
      </CardHeader>
      <CreateForm
        organizationId={currentOrgId}
        onSuccess={async () => {
          router.refresh();
          await queryClient.invalidateQueries(
            orpc.organization.projects.list.queryOptions({
              input: {
                organizationId: currentOrgId,
              },
            })
          );
        }}
      />
    </Card>
  );
};

export default Default;
