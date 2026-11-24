"use client";

import { Spinner } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

import { MemberOverview } from "./member-overview";
import { DashboardOverview } from "./overview";

export const Overview = () => {
  const session = useQuery(orpc.auth.session.queryOptions());

  if (session.error) {
    return <p className="text-danger py-8 text-sm">{session.error.message}</p>;
  }

  switch (session.data?.access.dashboard) {
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
