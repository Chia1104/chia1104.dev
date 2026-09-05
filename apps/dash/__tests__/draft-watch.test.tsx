import type { ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ watch: vi.fn(), get: vi.fn() }));
vi.mock("@/libs/orpc/client", async () => {
  const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
  return {
    orpc: createTanstackQueryUtils({
      feeds: { "draft:watch": api.watch, "draft:get": api.get },
    }),
  };
});

const { useDraftWatch } =
  await import("../src/components/feed/use-draft-watch");

afterEach(() => vi.useRealTimers());

it("retries a broken live stream and cancels on unmount", async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  api.watch.mockImplementation(
    async (_input, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      const attempt = signals.length;
      return (async function* () {
        yield { type: "resync" };
        if (attempt === 1) throw new Error("Disconnected");
        await new Promise<void>((resolve) =>
          signal.addEventListener("abort", () => resolve(), { once: true })
        );
      })();
    }
  );
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useDraftWatch(7), { wrapper });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(api.watch).toHaveBeenCalledTimes(1);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(api.watch).toHaveBeenCalledTimes(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(invalidate).toHaveBeenCalled();
  hook.unmount();
  expect(signals.at(-1)?.aborted).toBe(true);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  expect(api.watch).toHaveBeenCalledTimes(2);
  queryClient.clear();
});
