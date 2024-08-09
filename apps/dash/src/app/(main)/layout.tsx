import type { ReactNode } from "react";

import { redirect } from "next/navigation";
import "server-only";

import { auth } from "@chia/auth";

import SideBar from "./side-bar";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }
  return (
    <SideBar>
      <main>{children}</main>
    </SideBar>
  );
}
