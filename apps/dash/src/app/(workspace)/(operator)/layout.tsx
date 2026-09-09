import { redirect, unauthorized } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/services/auth/resources.rsc";

/** Every page below is operator-only; a member is sent back to the overview before anything renders. */
export default async function Layout({ children }: { children: ReactNode }) {
  const session = await getSession();

  if (!session.data) {
    unauthorized();
  }

  if (session.data.access.dashboard !== "operator") {
    redirect("/");
  }

  return children;
}
