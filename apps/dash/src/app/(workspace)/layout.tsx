import { unauthorized } from "next/navigation";
import type { ReactNode } from "react";
import { ViewTransition } from "react";

import { Separator } from "@heroui/react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@chia/ui/sidebar";

import { AppSidebar } from "@/components/commons/app-sidebar";
import Footer from "@/components/commons/footer";
import { NavBreadcrumbs } from "@/components/commons/nav-breadcrumbs";
import { getSession } from "@/services/auth/resources.rsc";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session.data) {
    unauthorized();
  }

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
          </header>
          {children}
          <Footer className="mt-auto" />
        </SidebarInset>
      </SidebarProvider>
    </ViewTransition>
  );
}
