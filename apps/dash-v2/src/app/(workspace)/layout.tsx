import { cookies } from "next/headers";
import { redirect, unauthorized } from "next/navigation";
import type { ReactNode } from "react";

import { Separator } from "@heroui/react";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@chia/ui/sidebar";

import { AppSidebar } from "@/components/commons/app-sidebar";
import Footer from "@/components/commons/footer";
import { NavBreadcrumbs } from "@/components/commons/nav-breadcrumbs";
import { getSession, getFullOrganization } from "@/services/auth/resources.rsc";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();
  const cookieStore = await cookies();
  const currentOrg = cookieStore.get("currentOrg");

  if (!session.data) {
    unauthorized();
  }

  if (!currentOrg?.value) {
    redirect("/onboarding");
  }

  const org = await getFullOrganization(currentOrg.value);

  if (org.error || !org.data) {
    redirect("/onboarding");
  }

  return (
    <SidebarProvider>
      <AppSidebar org={org.data.name} />
      <SidebarInset>
        <header className="bg-sidebar border-sidebar-border flex h-16 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <NavBreadcrumbs />
          </div>
        </header>
        {children}
        <Footer className="mt-auto" />
      </SidebarInset>
    </SidebarProvider>
  );
}
