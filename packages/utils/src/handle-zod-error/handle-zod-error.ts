import { type ZodTypeAny, ZodError, type ZodIssue } from "zod";

export type HandleZodErrorReturn = {
  message: string;
  issues?: ZodIssue[];
  isError: boolean;
};

export type HandleZodErrorOptions<T> = {
  schema: ZodTypeAny;
  /**
   * @deprecated use data instead
   */
  value?: string;
  data?: T;
  prefixErrorMessage?: string;
  preParse?: (data: T | string) => void;
  postParse?: (data: T | string) => void;
  onError?: (message: string, issues: ZodIssue[]) => void;
  onFinally?: () => void | HandleZodErrorReturn;
};

const handleZodError = <T = unknown>({
  schema,
  value,
  data,
  prefixErrorMessage = "",
  preParse,
  postParse,
  onError,
  onFinally,
}: HandleZodErrorOptions<T>): HandleZodErrorReturn => {
  try {
    preParse?.((value as string) ?? (data as T));
    schema.parse((value as string) ?? (data as T));
    postParse?.((value as string) ?? (data as T));
    return {
      message: "",
      isError: false,
    };
  } catch (error: any) {
    let message = "";
    if (error instanceof ZodError) {
      const issues = error.issues;
      message = `${prefixErrorMessage}${issues
        .map((issue) => issue.message)
        .join(", ")}`;
      onError?.(message, issues);
      return {
        message,
        issues: error.issues,
        isError: true,
      };
    }
    return {
      message: error?.message,
      issues: error?.issues,
      isError: true,
    };
  } finally {
    onFinally?.();
  }
};

export default handleZodError;
