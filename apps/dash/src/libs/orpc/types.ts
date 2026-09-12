import type {
  InferRouterContractOutputs,
  InferRouterContractInputs,
} from "@orpc/contract";

import type { routerContract } from "@chia/api/services/router.contract";

export type RouterOutputs = InferRouterContractOutputs<typeof routerContract>;

export type RouterInputs = InferRouterContractInputs<typeof routerContract>;
