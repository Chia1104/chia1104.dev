import { createServiceFactory } from "@chia/service-kit/factory";

import { agentKindFloors } from "../agents/kinds";

export default createServiceFactory({
  auth: { access: { agentKinds: agentKindFloors } },
});
