import type { NextRequest } from "next/server";

import { handlers } from "@chia/auth";

// @ts-expect-error - [INTERNALS]
export const GET = (req: NextRequest) => handlers.GET(req);

// @ts-expect-error - [INTERNALS]
export const POST = (req: NextRequest) => handlers.POST(req);
