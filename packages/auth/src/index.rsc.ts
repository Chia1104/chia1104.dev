import { cache } from "react";

import NextAuth from "next-auth";

import { getConfig } from "./config";

export type { Session } from "next-auth";

const { handlers, auth: defaultAuth, signIn, signOut } = NextAuth(getConfig());

const auth = cache(defaultAuth);

export { handlers, auth, signIn, signOut };

export { invalidateSessionToken, validateToken } from "./config";
