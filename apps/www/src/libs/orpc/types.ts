import type { InferRouterOutputs, InferRouterInputs } from "@orpc/server";

import type { router } from "@chia/api/orpc/router";

export type RouterOutputs = InferRouterOutputs<typeof router>;

export type RouterInputs = InferRouterInputs<typeof router>;
