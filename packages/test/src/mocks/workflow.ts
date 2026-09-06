import { vi } from "vitest";
import type { Mock } from "vitest";

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

export const createFakeRuns = () => ({
  get: getRun,
});

export const resetWorkflowMocks = () => {
  getRun.mockClear();
};
