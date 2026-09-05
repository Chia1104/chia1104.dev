import { unauthorized } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, ViewTransition } from "react";

import { Separator } from "@heroui/react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@chia/ui/sidebar";

import {
  AgentDrawer,
  AgentDrawerTrigger,
} from "@/components/agent/agent-drawer";
import { AppSidebar } from "@/components/commons/app-sidebar";
import Footer from "@/components/commons/footer";
import { NavBreadcrumbs } from "@/components/commons/nav-breadcrumbs";
import { getAccess, getSession } from "@/services/auth/resources.rsc";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();

  // A guest from the public site holds a session cookie but is not a person.
  if (!session.data || session.data.user.isAnonymous) {
    unauthorized();
  }
  // The writing agent is the operator's; a member never sees the trigger or the drawer.
  const access = await getAccess();
  const operator = access.data?.level === "operator";

  return (
    <ViewTransition>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="bg-sidebar border-sidebar-border flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" />
              <NavBreadcrumbs />
            </div>
            {operator ? (
              <div className="ml-auto flex items-center px-4">
                {/* Reads `?agent`; the boundary keeps the rest of the shell static. */}
                <Suspense>
                  <AgentDrawerTrigger />
                </Suspense>
              </div>
            ) : null}
          </header>
          {children}
          {operator ? (
            <Suspense>
              <AgentDrawer />
            </Suspense>
          ) : null}
          <Footer className="mt-auto" />
        </SidebarInset>
      </SidebarProvider>
    </ViewTransition>
  );
}
