/**
 * Drains an event iterator into `onEvent` until it ends or `signal` aborts.
 *
 * Aborting closes the iterator through `return()`, which is what cancels the underlying oRPC
 * event stream; without it a superseded or unmounted turn would keep the connection open.
 */
export const consumeStream = async <T>(
  iterable: AsyncIterable<T>,
  onEvent: (event: T) => void,
  signal: AbortSignal
): Promise<void> => {
  const iterator = iterable[Symbol.asyncIterator]();
  // `return()` on a torn-down transport may reject; that must neither go unhandled nor replace
  // the stream's own error.
  const close = () => iterator.return?.()?.catch(() => undefined);
  signal.addEventListener("abort", close, { once: true });

  try {
    while (!signal.aborted) {
      const next = await iterator.next();
      if (next.done) return;
      onEvent(next.value);
    }
  } finally {
    signal.removeEventListener("abort", close);
    await close();
  }
};
