"use client";

import Link from "next/link";
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
import { useQueryClient } from "@tanstack/react-query";
import { ChevronsUpDown, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@chia/auth/client";
import { SidebarMenu, SidebarMenuItem, useSidebar } from "@chia/ui/sidebar";

import { useGuardedRouter } from "@/libs/navigation-guard";
import { orpc } from "@/libs/orpc/client";

export function NavUser({
  user,
}: {
  user: {
    name: string;
    email: string | null;
    avatar: string;
  };
}) {
  const { open, isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();
  const router = useGuardedRouter();
  const queryClient = useQueryClient();
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <Dropdown>
          <Button
            size="lg"
            variant="ghost"
            fullWidth
            isIconOnly={isMobile ? false : !open}
            onPress={() => router.push("/settings")}>
            <Avatar className="size-8">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback>CN</AvatarFallback>
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
          <DropdownPopover>
            <DropdownMenu className="gap-2">
              <DropdownItem>
                <Avatar className="size-8">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback>CN</AvatarFallback>
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
                      try {
                        await signOut();
                      } catch {
                        toast.error("Could not sign out, please try again");
                        return;
                      }
                      queryClient.removeQueries({
                        queryKey: orpc.auth.session.key(),
                      });
                      router.push("/auth/login");
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
