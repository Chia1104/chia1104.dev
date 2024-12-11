import type { ReactNode } from "react";

import { unauthorized } from "next/navigation";
import "server-only";

import { auth } from "@chia/auth";

import SideBar from "./side-bar";

export default async function Layout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session) {
    unauthorized();
  }
  return (
    <SideBar>
      <main>{children}</main>
    </SideBar>
  );
}
