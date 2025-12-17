export class ParsedJSONError extends Error {
  public input: unknown;
  constructor(input: unknown) {
    super("Parsed JSON error");
    this.input = input;
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

/**
 * A utility function to handle asynchronous operations and return a Result object.
 *
 * @template T - The type of the successful result.
 * @template E - The type of the error. Default is Error.
 *
 * @param promise - The promise to be awaited or a synchronous value.
 *
 * @returns A Promise that resolves to a Result object containing the data or error.
 *
 * @example
 * ```typescript
 * const result = await tryCatch<Data>(fetchData());
 * if (result.error) {
 *   console.log(result.data);
 *   //                 ^^^ null
 *   console.error(result.error);
 *   //                   ^^^ Error
 * } else {
 *   console.log(result.data);
 *   //                 ^^^ Data
 * }
 * ```
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T> | T
): Promise<TryCatchResult<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}
