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
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";
import { OrgSwitcher } from "./org-switcher";

export function AppSidebar({
  org,
  ...props
}: React.ComponentProps<typeof Sidebar> & { org: string }) {
  const routeItems = useRouteItems();
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pt-3">
        <OrgSwitcher org={org} />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        <NavMain title="Overview" items={routeItems.overview} />
        <NavMain title="Projects" items={routeItems.project} />
        <NavMain title="Content" items={routeItems.content} />
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
