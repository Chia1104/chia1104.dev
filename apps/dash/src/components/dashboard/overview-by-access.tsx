"use client";

import { Spinner } from "@heroui/react";

import { useAccess } from "@/hooks/use-access";

import { MemberOverview } from "./member-overview";
import { DashboardOverview } from "./overview";

export const Overview = () => {
  const access = useAccess();

  if (access.error) {
    return <p className="text-danger py-8 text-sm">{access.error.message}</p>;
  }

  switch (access.data?.level) {
    case "operator":
      return <DashboardOverview />;
    case "member":
      return <MemberOverview />;
    default:
      return (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      );
  }
};
