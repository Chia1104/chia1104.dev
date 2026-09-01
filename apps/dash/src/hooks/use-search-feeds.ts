import { useMutation } from "@tanstack/react-query";

import { orpc } from "@/libs/orpc/client";

/** Mutation, not a query: user-triggered and debounced by the caller. */
export const useSearchFeeds = () =>
  useMutation(orpc.feeds["search:advanced"].mutationOptions());
