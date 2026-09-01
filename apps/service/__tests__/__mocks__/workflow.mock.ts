import type { Mock } from "vitest";

/** Real `workflow/api` opens a World LISTEN on first use; with no database that becomes an unhandled rejection. */

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
