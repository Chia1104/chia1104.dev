import type {
  InferContractRouterOutputs,
  InferContractRouterInputs,
} from "@orpc/contract";

import type { routerContract } from "@chia/api/orpc/contracts";

export type RouterOutputs = InferContractRouterOutputs<typeof routerContract>;

export type RouterInputs = InferContractRouterInputs<typeof routerContract>;
