"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownPopover,
  Button,
  Separator,
} from "@heroui/react";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";

import { authClient } from "@chia/auth/client";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@chia/ui/sidebar";

import { revokeCurrentOrg } from "@/server/org.action";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}) {
  const { open, isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dropdown>
          <SidebarMenuButton asChild>
            <Button
              size="lg"
              variant="ghost"
              fullWidth
              isIconOnly={isMobile ? false : !open}>
              <Avatar className="size-8">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">CN</AvatarFallback>
              </Avatar>
              {isMobile || open ? (
                <>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4" />
                </>
              ) : null}
            </Button>
          </SidebarMenuButton>
          <DropdownPopover>
            <DropdownMenu className="gap-2">
              <DropdownItem>
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs">{user.email}</span>
                </div>
              </DropdownItem>
              <Separator />
              <DropdownItem>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="size-4" />
                  <span>Settings</span>
                </Link>
              </DropdownItem>
              <Separator />
              <DropdownItem className="bg-transparent p-0">
                <Button
                  isPending={isPending}
                  variant="danger-soft"
                  fullWidth
                  onPress={() =>
                    startTransition(async () => {
                      await revokeCurrentOrg();
                      await authClient.signOut({
                        fetchOptions: {
                          onSuccess: () => {
                            router.push("/auth/login");
                          },
                        },
                      });
                    })
                  }>
                  <LogOut className="size-4" />
                  <span>Logout</span>
                </Button>
              </DropdownItem>
            </DropdownMenu>
          </DropdownPopover>
        </Dropdown>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
