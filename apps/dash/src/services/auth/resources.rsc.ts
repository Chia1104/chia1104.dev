import "server-only";
import { cache } from "react";

import { client } from "@/libs/orpc/client.rsc";

/** One answer per request; layouts decide what to render from `session.access`. */
export const getSession = cache(async () => await client.auth.session());
