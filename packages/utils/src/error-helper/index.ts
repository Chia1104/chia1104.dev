export class ParsedJSONError<TInput> extends Error {
  constructor(public input: TInput) {
    super("Parsed JSON error");
  }
}

interface TryCatchSuccess<T> {
  data: T;
  error: null;
}

interface TryCatchFailure<E> {
  data: null;
  error: E;
}

type TryCatchResult<T, E = Error> = TryCatchSuccess<T> | TryCatchFailure<E>;

export async function tryCatch<T, E = Error>(
  promise: Promise<T> | T
): Promise<TryCatchResult<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error:
        /* SAFETY: The producer contract guarantees this value satisfies E. */ error as E,
    };
  }
}

/** The message of a thrown value; `fallback`, or the value as text, when it is not an `Error`. */
export const messageOf = (cause: unknown, fallback?: string): string =>
  cause instanceof Error ? cause.message : (fallback ?? String(cause));

/** A thrown value as an `Error`, wrapped when something else was thrown. */
export const asError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));

/** A `fetch` or timer that observed its abort signal, not a failure. */
export const isAbortError = (cause: unknown): boolean =>
  cause instanceof Error && cause.name === "AbortError";
