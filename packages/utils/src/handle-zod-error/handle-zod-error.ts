import type { z } from "zod";
import { ZodError } from "zod";
import type { ZodIssue } from "zod";

export interface HandleZodErrorReturn {
  message: string;
  issues?: ZodIssue[];
  isError: boolean;
}

export interface HandleZodErrorOptions<T> {
  schema: z.ZodType<T>;
  data: T;
  prefixErrorMessage?: string;
  preParse?: (data: T) => void;
  postParse?: (data: T) => void;
  onError?: (message: string, issues: ZodIssue[]) => void;
  onFinally?: () => void | HandleZodErrorReturn;
}

const handleZodError = <T = unknown>({
  schema,
  data,
  prefixErrorMessage = "",
  preParse,
  postParse,
  onError,
  onFinally,
}: HandleZodErrorOptions<T>): HandleZodErrorReturn => {
  try {
    preParse?.(data);
    schema.parse(data);
    postParse?.(data);
    return {
      message: "",
      isError: false,
    };
  } catch (error: unknown) {
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
      message: `${prefixErrorMessage}${
        error instanceof Error ? error.message : String(error)
      }`,
      isError: true,
    };
  } finally {
    onFinally?.();
  }
};

export default handleZodError;
