import type { TestSession } from "./session";

export interface StructuralContext {
  headers: Headers;
  clientIP: string;
  config: { rateLimit: { windowMs: number; limit: number } };
  db: Record<string, never>;
  session: TestSession | null;
}

/**
 * Request-shaped fixture. Pass the consumer's context type as `TContext`; this package does
 * not import `@chia/api` so it stays a graph leaf.
 */
export const contextOf = <TContext = StructuralContext>(
  session: TestSession | null,
  extra?: Partial<TContext>
): TContext =>
  /* SAFETY: This fixture implements the context members exercised by oRPC tests. */ ({
    headers: new Headers(),
    clientIP: "127.0.0.1",
    config: { rateLimit: { windowMs: 60_000, limit: 100 } },
    db: {},
    session,
    ...extra,
  }) as TContext;

export interface StructuralServiceContext {
  headers: Headers;
  clientIP: string;
  db: Record<string, never>;
  kv: undefined;
}

export const serviceContextOf = <TContext = StructuralServiceContext>(
  overrides?: Partial<TContext>
): TContext =>
  /* SAFETY: This fixture implements the ServiceContext members exercised by policy tests. */ ({
    headers: new Headers(),
    clientIP: "1.2.3.4",
    db: {},
    kv: undefined,
    ...overrides,
  }) as TContext;
