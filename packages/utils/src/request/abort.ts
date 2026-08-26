export const untilAborted = <TValue>(
  request: Promise<TValue>,
  signal: AbortSignal | undefined
): Promise<TValue> => {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<TValue>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    void request.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
};
