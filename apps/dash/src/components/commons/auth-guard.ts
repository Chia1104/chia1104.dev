"use client";

import type { ReactNode } from "react";

import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";

interface Props {
  children: ReactNode | ((session: Session) => ReactNode);
  fallback?: ReactNode;
}

const AuthGuard = ({ children, fallback }: Props) => {
  const { data, isPending } = authClient.useSession();

  if (isPending || !data || typeof window === "undefined") {
    return fallback ?? null;
  }

  return typeof children === "function" ? children(data) : children;
};

export default AuthGuard;
