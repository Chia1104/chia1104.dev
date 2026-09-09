import { createServiceFactory } from "@chia/service-kit/bootstrap";

import { agentKindFloors } from "../agents/kinds";

export default createServiceFactory({
  auth: { access: { agentKinds: agentKindFloors } },
});
