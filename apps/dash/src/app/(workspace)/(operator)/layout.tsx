"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { Spinner } from "@heroui/react";

import { useAccess } from "@/hooks/use-access";

/** Every page below is operator-only; a member is sent back to the overview. */
const Layout = ({ children }: { children: ReactNode }) => {
  const access = useAccess();
  const router = useRouter();
  const level = access.data?.level;

  useEffect(() => {
    if (level === "member") router.replace("/");
  }, [level, router]);

  if (level === "operator") {
    return children;
  }

  if (access.error) {
    return (
      <p className="text-danger px-4 py-8 text-sm">{access.error.message}</p>
    );
  }

  return (
    <div className="flex min-h-96 flex-1 items-center justify-center">
      <Spinner aria-label="Verifying operator access" />
    </div>
  );
};

export default Layout;
