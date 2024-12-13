import type { Options } from "ky";

export const withInternalRequest = <TResult = unknown, TDto = unknown>(
  fn: (
    internal_requestSecret: string,
    dto: TDto,
    options?: Options
  ) => Promise<TResult>
) => {
  return async (
    internal_requestSecret: string,
    dto: TDto,
    options?: Options
  ) => {
    return await fn(internal_requestSecret, dto, options);
  };
};
