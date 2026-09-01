import { defineRailway, project } from "railway/iac";

import { createBetaResources } from "./environments/beta.ts";
import { createProductionResources } from "./environments/production.ts";

export default defineRailway((context) => {
  if (context.isEnvironment("beta")) {
    return project("chia1104.dev", {
      resources: createBetaResources(),
    });
  }

  if (context.isEnvironment("production")) {
    return project("chia1104.dev", {
      resources: createProductionResources(),
    });
  }

  throw new Error(`Unsupported Railway environment: ${context.environment}`);
});
