"use client";

import { useQuery } from "@tanstack/react-query";

import { authClient } from "@chia/auth/client";

/**
 * Agent routes need a user row to own sessions and spend. A visitor without a session gets a
 * guest one from better-auth's anonymous plugin; a signed-in person keeps their own. Runs once
 * per page load: the cookie carries the result across the rest.
 */
export const useGuestSession = () =>
  useQuery({
    queryKey: ["agent-guest-session"],
    queryFn: async () => {
      const current = await authClient.getSession();
      if (current.data) {
        return { userId: current.data.user.id };
      }
      const guest = await authClient.signIn.anonymous();
      if (guest.error) {
        throw new Error(guest.error.message ?? guest.error.statusText);
      }
      return { userId: guest.data.user.id };
    },
    staleTime: Infinity,
    retry: false,
  });
