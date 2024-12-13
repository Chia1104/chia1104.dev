import NextAuth from "next-auth";

import { getConfig } from "./config";

export type { Session } from "next-auth";

const { handlers, auth, signIn, signOut } = NextAuth(() => getConfig());

export { handlers, auth, signIn, signOut };

export { invalidateSessionToken, validateToken } from "./config";
