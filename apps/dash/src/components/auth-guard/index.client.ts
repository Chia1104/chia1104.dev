"use client";

import { useSession } from "next-auth/react";
import { Session } from "@chia/auth";
import { type ReactNode } from "react";

interface Props {
  children: ReactNode | ((session: Session) => ReactNode);
  fallback?: ReactNode;
}

const AuthGuard = ({ children, fallback }: Props) => {
  const { status, data } = useSession();

  if (status === "authenticated") {
    return typeof children === "function" ? children(data) : children;
  }

  return fallback ?? null;
};

export default AuthGuard;
