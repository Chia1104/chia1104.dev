import request from "@chia/utils/request";

import { env } from "./env";

export const BS_UPTIME_ENDPOINT = "https://uptime.betterstack.com/api";

export const BS_TEL_ENDPOINT = "https://telemetry.betterstack.com/api";

export const bsUptimeRequest = request({
  prefixUrl: BS_UPTIME_ENDPOINT,
  headers: {
    Authorization: `Bearer ${env.BS_UPTIME_TOKEN}`,
  },
});

export const bsTelRequest = request({
  prefixUrl: BS_TEL_ENDPOINT,
  headers: {
    Authorization: `Bearer ${env.BS_TEL_TOKEN}`,
  },
});
