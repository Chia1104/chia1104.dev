import { Client } from "pg";

export interface ListenChannelOptions {
  /** Ends the listener; nothing reconnects after it fires. */
  signal: AbortSignal;
  /** A lost or refused connection. The listener reconnects on its own; this is for the log. */
  onError?: (error: Error) => void;
  onConnect?: () => void;
}

const MIN_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

/**
 * Keeps LISTEN on a dedicated connection and reconnects with backoff after a disconnect.
 */
export const listenChannel = (
  url: string,
  channel: string,
  onNotice: (payload: string) => void,
  options: ListenChannelOptions
): void => {
  let attempt = 0;

  const schedule = () => {
    if (options.signal.aborted) return;
    attempt += 1;
    const delay = Math.min(MAX_RETRY_MS, MIN_RETRY_MS * 2 ** (attempt - 1));
    const cancel = () => clearTimeout(timer);
    const timer = setTimeout(() => {
      options.signal.removeEventListener("abort", cancel);
      void connect();
    }, delay);
    options.signal.addEventListener("abort", cancel, { once: true });
  };

  const connect = async () => {
    if (options.signal.aborted) return;
    const client = new Client({ connectionString: url, keepAlive: true });
    let gone = false;
    const stop = () => {
      gone = true;
      client.end().catch(() => undefined);
    };
    // One retry per connection: `error` and the `end` it triggers both land here.
    const drop = (error?: Error) => {
      if (gone) return;
      options.signal.removeEventListener("abort", stop);
      stop();
      if (error !== undefined) options.onError?.(error);
      schedule();
    };

    client.on("error", drop);
    client.on("end", () => drop());
    client.on("notification", (message) => {
      if (message.channel === channel && message.payload !== undefined) {
        onNotice(message.payload);
      }
    });
    options.signal.addEventListener("abort", stop, { once: true });

    try {
      await client.connect();
      await client.query(`LISTEN ${client.escapeIdentifier(channel)}`);
      attempt = 0;
      options.onConnect?.();
    } catch (error) {
      drop(error instanceof Error ? error : new Error(String(error)));
    }
  };

  void connect();
};
