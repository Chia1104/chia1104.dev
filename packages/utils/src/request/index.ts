import type { Options, HTTPError, SearchParamsOption } from "ky";
import ky from "ky";

export type { HTTPError };

export interface ErrorResponse {
  status?: number;
  code: string;
  errors?:
    | {
        field: string;
        message: string;
        code?: string;
      }[]
    | null;
}

export interface PaginatedMeta {
  totalRows: number;
  totalPages: number;
  currentPage: number;
  perPage: number;
}

export interface Paginated<T = unknown> {
  data: T[];
  meta: PaginatedMeta;
}

const request = (defaultOptions?: Options) => {
  return ky.extend({
    timeout: 30_000,
    credentials: "include",
    ...defaultOptions,
  });
};

export const X_CF_BYPASS_TOKEN = "x-cf-bypass-token";

interface SetSearchParamsOptions {
  baseUrl?: string;
}

export const setSearchParams = <
  T extends Partial<Record<string, string | null>>,
>(
  searchParams?: T,
  opts?: SetSearchParamsOptions
) => {
  opts ??= {};
  const { baseUrl } = opts;
  const url = baseUrl
    ? baseUrl.replace(/\/$/, "").replace(/\?$/, "") + "?"
    : "";
  return (
    url +
    Object.entries({ ...searchParams })
      .map(
        ([key, value]) =>
          value && `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .filter(Boolean)
      .join("&")
  );
};

export const get = async <
  T = unknown,
  U extends SearchParamsOption = SearchParamsOption,
>(
  url: string,
  data?: U,
  opts?: Options,
  defaultOptions?: Options
): Promise<T> => {
  return await request(defaultOptions)
    .get(url, { searchParams: data, ...opts })
    .json();
};

export const post = async <T = unknown, U = unknown>(
  url: string,
  data: U,
  opts?: Options,
  defaultOptions?: Options
): Promise<T> => {
  return await request(defaultOptions)
    .post(url, { json: data, ...opts })
    .json();
};

export const put = async <T = unknown, U = unknown>(
  url: string,
  data: U,
  opts?: Options,
  defaultOptions?: Options
): Promise<T> => {
  return await request(defaultOptions)
    .put(url, { json: data, ...opts })
    .json();
};

export const del = async <T = unknown>(
  url: string,
  opts?: Options,
  defaultOptions?: Options
): Promise<T> => {
  return await request(defaultOptions).delete(url, opts).json();
};

export const patch = async <T = unknown, U = unknown>(
  url: string,
  data: U,
  opts?: Options,
  defaultOptions?: Options
): Promise<T> => {
  return await request(defaultOptions)
    .patch(url, { json: data, ...opts })
    .json();
};

export interface TextStream {
  [Symbol.asyncIterator]: () => AsyncGenerator<string>;
  stream: ReadableStream<Uint8Array>;
}

export const postTextStream = async <TBody>(
  url: string,
  data: TBody,
  opts?: Options,
  defaultOptions?: Options
): Promise<TextStream> => {
  const response = await request({
    timeout: false,
    ...defaultOptions,
  }).post(url, { json: data, ...opts });
  const stream = response.body;

  if (!stream) {
    throw new TypeError("Stream response body is undefined");
  }

  const decoder = new TextDecoder();

  return {
    async *[Symbol.asyncIterator]() {
      const reader = stream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          yield decoder.decode(value);
        }
      } finally {
        reader.releaseLock();
      }
    },
    stream,
  };
};

export const handleKyError = async <TError extends HTTPError>(
  error: TError
): Promise<ErrorResponse> => {
  switch (error.name) {
    case "HTTPError": {
      const { response } = error;
      if (response?.body) {
        try {
          return /* SAFETY: The producer contract guarantees this value satisfies ErrorResponse. */ (await error.response
            .clone()
            .json()) as ErrorResponse;
        } catch (err) {
          console.error(err);
          return {
            code: "unknown error",
          };
        }
      }
      return {
        code: "unknown error",
      };
    }
    default: {
      return {
        code: "unknown error",
      };
    }
  }
};

export default request;
