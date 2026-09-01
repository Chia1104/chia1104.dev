import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";
import { createWorkflowControlClient } from "@chia/workflow-control/client";

import { env } from "../env";

/**
 * `apps/workflow` has one control route at its root and is only reachable over the private
 * network, so the endpoint has no version prefix.
 */
const resolveControlUrl = (): string => {
  const url = withServiceEndpoint("/", Service.Workflow, {
    isInternal: true,
    version: "NO_PREFIX",
  });
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      "INTERNAL_WORKFLOW_SERVICE_ENDPOINT is required to reach apps/workflow."
    );
  }
  return url;
};

/** The only client this process uses for queue mutations and run reconciliation. */
export const workflowControl = createWorkflowControlClient({
  url: resolveControlUrl(),
  token: env.INTERNAL_WORKFLOW_SERVICE_TOKEN,
});
