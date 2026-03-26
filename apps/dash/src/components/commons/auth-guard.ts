"use client";

import type { ReactNode } from "react";

import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";
import { Role } from "@chia/db/types";

interface Props {
  children: ReactNode | ((session: Session) => ReactNode);
  fallback?: ReactNode;
  roles?: Role[];
}

export const useAuthGuard = (
  roles: Role[] = [Role.User, Role.Admin, Role.Root]
) => {
  const { data, isPending } = authClient.useSession();

  if (isPending || !data) {
    return null;
  }

  if (roles && !roles.includes(data.user.role)) {
    return null;
  }

  return data;
};

const AuthGuard = ({
  children,
  fallback,
  roles = [Role.User, Role.Admin, Role.Root],
}: Props) => {
  const data = useAuthGuard(roles);

  if (!data) {
    return fallback ?? null;
  }

  return typeof children === "function" ? children(data) : children;
};

export default AuthGuard;
