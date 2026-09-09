import { unauthorized } from "next/navigation";
import type { ReactNode } from "react";
import { ViewTransition } from "react";

import { Separator } from "@heroui/react";

import { AgentContextProvider } from "@chia/agent-elements/context";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@chia/ui/sidebar";

import { AgentDock, AgentDockTrigger } from "@/components/agent/agent-dock";
import { AppSidebar } from "@/components/commons/app-sidebar";
import Footer from "@/components/commons/footer";
import { NavBreadcrumbs } from "@/components/commons/nav-breadcrumbs";
import { getSession } from "@/services/auth/resources.rsc";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // A guest from the public site holds a session cookie but has no dashboard.
  if (!session.data || session.data.access.dashboard === null) {
    unauthorized();
  }
  // The writing agent is the operator's; a member never sees the trigger or the dock.
  const operator = session.data.access.dashboard === "operator";

  // Pages provide what they have open (the editor's draft) and the dock sends it.
  return (
    <ViewTransition>
      <AgentContextProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="@container/page">
            <header className="bg-sidebar border-sidebar-border flex h-12 shrink-0 items-center gap-2 border-b">
              <div className="flex min-w-0 flex-1 items-center gap-2 px-4">
                <SidebarTrigger className="shrink-0" />
                <Separator className="shrink-0" orientation="vertical" />
                <div className="min-w-0 overflow-x-auto">
                  <NavBreadcrumbs />
                </div>
              </div>
              {operator ? (
                <div className="ml-auto flex shrink-0 items-center px-4">
                  <AgentDockTrigger />
                </div>
              ) : null}
            </header>
            {children}
            <Footer className="mt-auto" />
          </SidebarInset>
          {/* Sibling of the inset, so the docked agent takes width from the page instead of covering it. */}
          {operator ? <AgentDock /> : null}
        </SidebarProvider>
      </AgentContextProvider>
    </ViewTransition>
  );
}
