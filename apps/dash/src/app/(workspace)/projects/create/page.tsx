"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ViewTransition } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { EditForm } from "@/components/projects/edit-form";
import type { FormData } from "@/components/projects/edit-form";
import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

export default function Page() {
  const { currentOrgId } = useOrganizationStore((state) => state);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { mutate } = useMutation(
    orpc.organization.projects.create.mutationOptions({
      onSuccess: async (data) => {
        if (data[0]) {
          toast.success("Project created successfully");
          router.push(`/projects/${data[0].slug}`);
          await queryClient.invalidateQueries(
            orpc.organization.projects.list.queryOptions({
              input: {
                organizationId: currentOrgId,
              },
            })
          );
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleSubmit = (data: FormData) => {
    mutate({
      ...data,
      organizationId: currentOrgId,
    });
  };

  return (
    <ViewTransition>
      <div className="grid min-h-[95svh] lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex w-full flex-1 items-center justify-center">
            <div className="flex w-full flex-col gap-4">
              <h2 className="text-2xl font-bold">Create New Project</h2>
              <EditForm onSubmit={handleSubmit} />
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <Image
            src="/project-background.jpg"
            alt="Feature Background"
            fill
            className="h-full w-full object-cover"
          />
        </div>
      </div>
    </ViewTransition>
  );
}
