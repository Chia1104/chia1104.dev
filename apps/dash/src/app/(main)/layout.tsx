import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { auth } from "@chia/auth";

import Menu from "./menu";
import SideBar from "./side-bar";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/auth/signin");
  }
  return (
    <SideBar>
      <Menu />
      <main>{children}</main>
    </SideBar>
  );
}
