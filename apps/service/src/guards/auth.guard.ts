// verifyAuth was promoted to @chia/auth/middlewares so the standalone
// services (ai, ...) share the same trusted-header fast-path implementation.
export { verifyAuth } from "@chia/auth/middlewares";
