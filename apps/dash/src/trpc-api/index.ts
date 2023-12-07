import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@chia/api/trpc";

export const api = createTRPCReact<AppRouter>({
  abortOnUnmount: true,
});

export { type RouterInputs, type RouterOutputs } from "@chia/api/trpc";
