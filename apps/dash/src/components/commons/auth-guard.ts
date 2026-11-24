"use client";

import type { ReactNode } from "react";

import { useQuery } from "@tanstack/react-query";

import type { Session } from "@chia/services/auth/auth.contract";

import { orpc } from "@/libs/orpc/client";

interface Props {
  children: ReactNode | ((session: Session) => ReactNode);
  fallback?: ReactNode;
}

export const useAuthGuard = () => {
  const { data } = useQuery(orpc.auth.session.queryOptions());
  return data ?? null;
};

const AuthGuard = ({ children, fallback }: Props) => {
  const data = useAuthGuard();

  if (!data) {
    return fallback ?? null;
  }

  return children instanceof Function ? children(data) : children;
};

export default AuthGuard;
