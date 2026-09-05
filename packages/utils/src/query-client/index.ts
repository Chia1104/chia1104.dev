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

/**
 * The first request refreshes at once; a burst inside the window collapses into one trailing
 * refresh, and one more is kept behind a request still in flight so a write that landed
 * during it is not missed.
 */
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
    leading: true,
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
