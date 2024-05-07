import type { ReactNode } from "react";
import Menu from "./menu";
import SideBar from "./side-bar";
import { auth } from "@chia/auth";
import { redirect } from "next/navigation";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    redirect("/signin");
  }
  return (
    <SideBar>
      <Menu />
      <main>{children}</main>
    </SideBar>
  );
}
