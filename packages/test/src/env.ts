import { vi } from "vitest";

export const stubTestEnv = (
  values: Record<string, string | undefined> = {}
) => {
  vi.stubEnv("SKIP_ENV_VALIDATION", values.SKIP_ENV_VALIDATION ?? "1");
  vi.stubEnv("NODE_ENV", values.NODE_ENV ?? "test");
  for (const [key, value] of Object.entries(values)) {
    if (key === "SKIP_ENV_VALIDATION" || key === "NODE_ENV") continue;
    vi.stubEnv(key, value);
  }
};
