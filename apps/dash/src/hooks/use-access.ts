import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

/** The server's answer to "what may this person see"; navigation and route groups read it. */
export const useAccess = () =>
  useQuery(orpc.dashboard.access.queryOptions({ staleTime: 5 * 60 * 1000 }));
