"use client";

import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Divider,
} from "@heroui/react";
import { useTransitionRouter } from "next-view-transitions";
import { toast } from "sonner";

import { useOrganizationStore } from "@/store/organization.store";
import { api } from "@/trpc/client";

const Default = () => {
  const router = useTransitionRouter();
  const { currentOrgSlug } = useOrganizationStore((state) => state);
  const { data } = api.organization.getOrganization.useQuery({
    slug: currentOrgSlug,
  });
  const { mutate } = api.organization.deleteOrganization.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted successfully");
      router.push("/onboarding");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
  return (
    <div className="w-full flex flex-col gap-5">
      <h2 className="text-xl font-bold">{data?.name}</h2>
      <Divider />
      <h3 className="text-danger">Danger Zone</h3>
      <Popover>
        <PopoverTrigger>
          <Button color="danger" variant="ghost" className="w-fit">
            Delete Organization
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-4 gap-3">
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
