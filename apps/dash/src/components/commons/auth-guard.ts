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

  if (!isPending && data) {
    return typeof children === "function" ? children(data) : children;
  }

  return fallback ?? null;
};

export default AuthGuard;
