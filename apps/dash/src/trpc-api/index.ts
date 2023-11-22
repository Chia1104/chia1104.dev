import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@chia/api";

export const api = createTRPCReact<AppRouter>({
  abortOnUnmount: true,
});

export { type RouterInputs, type RouterOutputs } from "@chia/api";
