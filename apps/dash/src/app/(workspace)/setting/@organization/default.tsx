"use client";

import { useTransitionRouter } from "next-view-transitions";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Divider,
} from "@heroui/react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";
import { useOrganizationStore } from "@/store/organization.store";

const Default = () => {
  const router = useTransitionRouter();
  const { currentOrgSlug } = useOrganizationStore((state) => state);
  const { data } = useQuery(
    orpc.organization.details.queryOptions({
      input: {
        slug: currentOrgSlug,
      },
    })
  );

  const { mutate } = useMutation(
    orpc.organization.delete.mutationOptions({
      onSuccess: () => {
        toast.success("Organization deleted successfully");
        router.push("/onboarding");
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  return (
    <div className="flex w-full flex-col gap-5">
      <h2 className="text-xl font-bold">{data?.name}</h2>
      <Divider />
      <h3 className="text-danger">Danger Zone</h3>
      <Popover>
        <PopoverTrigger>
          <Button color="danger" variant="ghost" className="w-fit">
            Delete Organization
          </Button>
        </PopoverTrigger>
        <PopoverContent className="gap-3 p-4">
          <div className="text-small font-bold">
            Are you sure you want to delete this organization?
          </div>
          <Button
            isLoading={false}
            color="danger"
            variant="flat"
            onPress={() => data?.id && mutate({ id: data?.id })}>
            Delete
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default Default;
