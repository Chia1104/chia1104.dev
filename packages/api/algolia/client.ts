import type {
  Response as AlgoliaResponse,
  EndRequest,
  Requester,
} from "@algolia/client-common";
import { algoliasearch } from "algoliasearch";

import { env } from "./env";

interface FetchRequesterOptions {
  readonly requesterOptions?: RequestInit | undefined;
}

/**
 * Currently, the algolia client is not compatible with the `workflow` package,
 * Original `createFetchRequester` is using `AbortController` to handle the timeout,
 * which is not supported in the `workflow` package.
 * This function is a workaround to create a fetch requester that is compatible with the `workflow` package.
 * @see https://github.com/algolia/algoliasearch-client-javascript/blob/main/packages/requester-fetch/src/createFetchRequester.ts
 */
const createFetchRequester = ({
  requesterOptions = {},
}: FetchRequesterOptions = {}): Requester => {
  async function send(request: EndRequest): Promise<AlgoliaResponse> {
    let fetchRes: Response;
    try {
      fetchRes = await fetch(request.url, {
        method: request.method,
        body: (request.data as BodyInit) || null,
        redirect: "manual",
        ...requesterOptions,
        headers: {
          ...requesterOptions.headers,
          ...request.headers,
        },
      });
    } catch (error) {
      return {
        status: 0,
        content: error instanceof Error ? error.message : "Unknown error",
        isTimedOut: false,
      };
    }

    try {
      const content = await fetchRes.text();

      return {
        content,
        isTimedOut: false,
        status: fetchRes.status,
      };
    } catch (error) {
      return {
        status: 0,
        content: error instanceof Error ? error.message : "Unknown error",
        isTimedOut: false,
      };
    }
  }

  return { send };
};

let instance: ReturnType<typeof algoliasearch> | undefined;

/**
 * Lazily constructed.
 *
 * `algoliasearch()` throws when `appId` is empty, so building it at module scope made
 * merely importing anything that transitively reaches this file require Algolia
 * credentials. That broke `apps/dash`, which imports the oRPC router for its in-process
 * RSC client and has no Algolia configuration of its own.
 */
export const getAlgoliaClient = () => {
  instance ??= algoliasearch(
    env.ALGOLIA_APPLICATION_ID ?? "",
    env.ALGOLIA_API_KEY ?? "",
    {
      requester: createFetchRequester(),
    }
  );
  return instance;
};
