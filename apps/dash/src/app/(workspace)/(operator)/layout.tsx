import { redirect, unauthorized } from "next/navigation";
import type { ReactNode } from "react";

import { getAccess } from "@/services/auth/resources.rsc";

/** Every page below is operator-only; a member is sent back to the overview before anything renders. */
export default async function Layout({ children }: { children: ReactNode }) {
  const { data, error } = await getAccess();

  if (error) {
    unauthorized();
  }

  if (data.level !== "operator") {
    redirect("/");
  }

  return children;
}
