import type { Options } from "ky";

import type { Monitors } from "../types";
import { bsUptimeRequest } from "../utils";

export const getMonitors = (options?: Options) =>
  bsUptimeRequest.get("v2/monitors", options).json<Monitors>();
