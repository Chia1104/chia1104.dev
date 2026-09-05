import { AsyncQueuer, Throttler } from "@tanstack/react-pacer";
import type { QueryKey } from "@tanstack/react-query";
import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import SuperJSON from "superjson";

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: false,
      },
      dehydrate: {
        serializeData: SuperJSON.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: {
        deserializeData: SuperJSON.deserialize,
      },
    },
  });

let clientQueryClientSingleton: QueryClient | undefined;

export const getQueryClient = () => {
  if (!("window" in globalThis)) {
    return createQueryClient();
  }

  return (clientQueryClientSingleton ??= createQueryClient());
};

/** Coalesces live invalidations and retains one refresh after an in-flight request. */
export const createQueryInvalidator = (
  queryClient: QueryClient,
  queryKey: QueryKey
) => {
  const queue = new AsyncQueuer<QueryKey>(
    () =>
      queryClient.invalidateQueries(
        { queryKey, exact: true },
        { cancelRefetch: false }
      ),
    {
      concurrency: 1,
      maxSize: 1,
      wait: 1000,
      onError: (error) => console.error("Live query refresh failed", error),
    }
  );
  const throttle = new Throttler(() => queue.addItem(queryKey), {
    wait: 1000,
    leading: false,
    trailing: true,
  });

  return {
    request: () => throttle.maybeExecute(),
    dispose: () => {
      throttle.cancel();
      queue.stop();
      queue.clear();
    },
  };
};
