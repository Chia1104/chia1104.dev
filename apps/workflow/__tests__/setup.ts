import { stubTestEnv } from "@chia/test/env";

stubTestEnv({
  INTERNAL_WORKFLOW_SERVICE_TOKEN: "w".repeat(32),
});
