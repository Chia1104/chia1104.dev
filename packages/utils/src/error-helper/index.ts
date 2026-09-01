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
