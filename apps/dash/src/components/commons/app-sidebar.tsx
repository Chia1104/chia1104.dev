"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@chia/ui/sidebar";

import { useRouteItems } from "@/shared/routes";

import AuthGuard from "./auth-guard";
import { Logo } from "./logo";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const routeItems = useRouteItems();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pt-3">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavMain title="Overview" items={routeItems.overview} />
        <NavMain title="Content" items={routeItems.content} />
        <NavMain title="RAG" items={routeItems.rag} />
        <NavMain title="Agents" items={routeItems.agents} />
        <NavMain title="Settings" items={routeItems.settings} />
      </SidebarContent>
      <SidebarFooter className="pb-4">
        <AuthGuard>
          {(user) => (
            <NavUser
              user={{
                name: user.user.name,
                email: user.user.email,
                avatar: user.user.image ?? "",
              }}
            />
          )}
        </AuthGuard>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
