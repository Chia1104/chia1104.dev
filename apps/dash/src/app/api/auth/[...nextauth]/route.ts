import type { NextRequest } from "next/server";

import { handlers } from "@chia/auth";

// @ts-expect-error: Next.js issue - https://github.com/vercel/next.js/issues/59823
export const GET = (req: NextRequest) => handlers.GET(req);

// @ts-expect-error: Next.js issue - https://github.com/vercel/next.js/issues/59823
export const POST = (req: NextRequest) => handlers.POST(req);
