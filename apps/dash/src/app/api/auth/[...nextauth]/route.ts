import NextAuth from "next-auth";
import { authOptions } from "@chia/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
