import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { isOriginRequestAllowed } from "@chia/utils/server/origin";

import { env } from "./env";

/** Every path, static files included: a client that skips Cloudflare reaches none of them. */
export function proxy(request: NextRequest) {
  return isOriginRequestAllowed(request.headers, env.ORIGIN_SECRET)
    ? NextResponse.next()
    : new NextResponse(null, { status: 403 });
}
