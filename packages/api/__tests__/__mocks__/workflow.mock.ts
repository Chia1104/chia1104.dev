import type { Mock } from "vitest";

/**
 * The real module builds the SDK World on first use, and the Postgres World opens a
 * `LISTEN` connection the moment it is created. With no database behind the tests that
 * surfaces as an unhandled rejection. Nothing here touches a World.
 */

const emptyReadable = () =>
  Object.assign(new ReadableStream<never>({ start: (c) => c.close() }), {
    getTailIndex: async () => -1,
  });

export const getRun: Mock = vi.fn(() => ({
  exists: Promise.resolve(false),
  status: Promise.resolve("completed"),
  returnValue: Promise.resolve(undefined),
  getReadable: vi.fn(emptyReadable),
  cancel: vi.fn(async () => undefined),
}));

export const getHookByToken: Mock = vi.fn(async () => null);

export const resetWorkflowMocks = () => {
  getRun.mockClear();
  getHookByToken.mockClear();
};
