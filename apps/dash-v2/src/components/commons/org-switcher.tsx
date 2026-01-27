"use client";

import { useRouter } from "next/navigation";
import * as React from "react";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  Button,
  Skeleton,
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

const OrgList = ({ onClose }: { onClose?: () => void }) => {
  const { data, isPending: isLoading } = authClient.useListOrganizations();
  const [isPending, startTransition] = React.useTransition();
  const router = useRouter();
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
    <DropdownMenu className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg">
      {data.map((team) => (
        <DropdownItem
          key={team.slug}
          isDisabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setCurrentOrg(team.slug);
              router.refresh();
              router.push("/");
              onClose?.();
            })
          }
          className="gap-2 p-2">
          {team.name}
        </DropdownItem>
      ))}
      <DropdownItem className="gap-2 p-2">
        <Plus className="size-4" />
        <div className="text-muted-foreground font-medium">
          Create New Organization
        </div>
      </DropdownItem>
    </DropdownMenu>
  );
};

export function OrgSwitcher({ org }: { org: string }) {
  const { open, isMobile } = useSidebar();
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
            <OrgList />
          </DropdownPopover>
        </Dropdown>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
