import { ZodError, type ZodIssue, type ZodType } from "zod";

export type HandleZodErrorReturn<TData> =
  | {
      issues: ZodIssue[];
      error: ZodError;
      isError: true;
    }
  | {
      isError: false;
      data: TData;
    };

export type HandleZodErrorOptions<
  TSourceData = unknown,
  TFormatData = unknown,
> = {
  schema: ZodType<TSourceData>;
  data: TSourceData;
  preParse?: (data: TSourceData) => void;
  postParse?: (data: TSourceData) => void;
  onFormat?: (data: TSourceData) => TFormatData;
  onError?: (issues: ZodIssue[]) => void;
  onFinally?: () => void;
};

/**
 *
 * @example
 * ```ts
 * const test = () => {
 *      const testSchema = z.object({
 *          name: z.string(),
 *          age: z.number(),
 *      });
 *
 *      const testData = {
 *          name: "John",
 *          age: 30,
 *      };
 *      const result = handleZodError({
 *          schema: testSchema,
 *          data: testData,
 *          onFormat: (data) => {
 *              return {
 *                  foo: data.name,
 *                  bar: data.age,
 *              };
 *          },
 *      });
 *
 *      if (result.isError) {
 *          console.log("Error", result.issues);
 *          return;
 *      }
 *      console.log("Data", result.data);
 * }
 * ```
 */
const handleZodError = <TSourceData = unknown, TFormatData = TSourceData>({
  schema,
  data,
  preParse,
  postParse,
  onFormat,
  onError,
  onFinally,
}: HandleZodErrorOptions<
  TSourceData,
  TFormatData
>): HandleZodErrorReturn<TFormatData> => {
  try {
    preParse?.(data);
    schema.parse(data);
    postParse?.(data);

    if (onFormat) {
      const formattedData = onFormat(data);
      return { isError: false, data: formattedData };
    }
    /**
     * @todo correct the return type
     */
    return { isError: false, data: data as any };
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      const issues = error.issues;
      onError?.(issues);
      return { isError: true, issues, error };
    }
    throw error;
  } finally {
    onFinally?.();
  }
};

export default handleZodError;
