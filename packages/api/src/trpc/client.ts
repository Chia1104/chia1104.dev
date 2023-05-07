import { createTRPCProxyClient, httpLink, loggerLink } from "@trpc/client";
import type { AppRouter } from "../root";
import { getUrl, transformer } from "./shared";

export type * from "./shared";

export const api = createTRPCProxyClient<AppRouter>({
  transformer,
  links: [
    loggerLink(),
    (runtime) => {
      return (ctx) => {
        const { op } = ctx;
        const { path } = op;

        const link = httpLink({
          url: getUrl(),
          fetch: (url, opts) => {
            return fetch(url, {
              ...opts,
              next: { tags: [path] },
            });
          },
        })(runtime);

        return link(ctx);
      };
    },
  ],
});
