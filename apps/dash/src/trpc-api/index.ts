import { createTRPCReact } from "@trpc/react-query";

import type { AppRouter } from "@chia/api";

export const api = createTRPCReact<AppRouter>();

export { type RouterInputs, type RouterOutputs } from "@chia/api";
