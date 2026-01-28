"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import type { Key } from "@heroui/react";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  Button,
  Skeleton,
  Modal,
} from "@heroui/react";
import { ChevronsUpDown, Plus } from "lucide-react";

import { authClient } from "@chia/auth/client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@chia/ui/sidebar";

import { setCurrentOrg } from "@/server/org.action";

import { OnboardingForm } from "../auth/onboarding-form";

const CreateModal = ({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-md">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>Create New Organization</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="p-4">
            <OnboardingForm onSuccess={() => onOpenChange(false)} />
          </Modal.Body>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
};

const OrgList = ({
  onClose,
  handleOpenCreateModal,
}: {
  onClose?: () => void;
  handleOpenCreateModal: () => void;
}) => {
  const { data, isPending: isLoading } = authClient.useListOrganizations();
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();

  const handleAction = (key: Key) => {
    if (key === "create-org") {
      handleOpenCreateModal();
    } else {
      startTransition(async () => {
        if (typeof key !== "string") return;
        const slug = key.split("-")[1];
        if (slug) {
          await setCurrentOrg(slug);
          router.refresh();
          router.push("/");
          onClose?.();
        }
      });
    }
  };

  if (!data || isLoading) {
    return (
      <DropdownMenu className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
        {Array(3).map((_, index) => (
          <DropdownItem key={index} className="gap-2 p-2">
            <Skeleton className="h-8 w-20 rounded-full" />
          </DropdownItem>
        ))}
      </DropdownMenu>
    );
  }

  return (
    <>
      <DropdownMenu
        onAction={handleAction}
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
        {data.map((team) => (
          <DropdownItem
            key={team.slug}
            id={`org-${team.slug}`}
            isDisabled={isPending}
            className="gap-2 p-2">
            {team.name}
          </DropdownItem>
        ))}
        <DropdownItem id="create-org">
          <Plus className="size-4" /> Create New Organization
        </DropdownItem>
      </DropdownMenu>
    </>
  );
};

export function OrgSwitcher({ org }: { org: string }) {
  const { open, isMobile } = useSidebar();
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dropdown>
          <SidebarMenuButton asChild>
            <Button
              variant="ghost"
              fullWidth
              isIconOnly={isMobile ? false : !open}
              size="lg">
              {isMobile || open ? (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{org}</span>
                </div>
              ) : null}
              <ChevronsUpDown className="size-4" />
            </Button>
          </SidebarMenuButton>
          <DropdownPopover>
            <OrgList handleOpenCreateModal={() => setIsOpen(true)} />
          </DropdownPopover>
        </Dropdown>
      </SidebarMenuItem>
      <CreateModal isOpen={isOpen} onOpenChange={setIsOpen} />
    </SidebarMenu>
  );
}
