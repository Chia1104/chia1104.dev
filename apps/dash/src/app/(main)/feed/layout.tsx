import type { ReactNode } from "react";

import { redirect } from "next/navigation";
import "server-only";

import { auth } from "@chia/auth";

const Layout = async ({ children }: { children: ReactNode }) => {
  const session = await auth();
  if (!session) redirect("/login");

  return <article className="c-container main">{children}</article>;
};

export default Layout;
