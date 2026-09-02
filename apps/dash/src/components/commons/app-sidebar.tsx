"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@chia/ui/sidebar";

import { useAccess } from "@/hooks/use-access";
import { useRouteItems } from "@/shared/routes";

import AuthGuard from "./auth-guard";
import { Logo } from "./logo";
import { NavMain } from "./nav-main";
import { NavUser } from "./nav-user";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const access = useAccess();
  // Until the server answers, show the member set so operator links never flash for a member.
  const routeItems = useRouteItems(access.data?.level ?? "member");
  const groups = [
    { title: "Overview", items: routeItems.overview },
    { title: "Content", items: routeItems.content },
    { title: "RAG", items: routeItems.rag },
    { title: "Agents", items: routeItems.agents },
    { title: "Settings", items: routeItems.settings },
  ].filter((group) => group.items.length > 0);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="pt-3">
        <Logo />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {groups.map((group) => (
          <NavMain key={group.title} title={group.title} items={group.items} />
        ))}
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
