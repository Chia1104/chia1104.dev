import ky from "ky";
import type { Options, HTTPError, SearchParamsOption } from "ky";

import { getServiceEndPoint } from "../config";

export type { HTTPError };

export interface ErrorResponse {
  status?: number;
  code: string;
  errors?:
    | {
        field: string;
        message: string;
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
    timeout: 10000,
    credentials: "include",
    hooks: {
      beforeRequest: [
        (request) => {
          request.headers.set("Content-Type", "application/json");
        },
      ],
    },
    ...defaultOptions,
  });
};

type ServiceRequestOptions = Options &
  (
    | {
        isInternal?: false;
      }
    | {
        isInternal: true;
        internal_requestSecret: string;
      }
  );

export const serviceRequest = (defaultOptions?: ServiceRequestOptions) => {
  return request({
    ...defaultOptions,
    prefixUrl: getServiceEndPoint(undefined, {
      isInternal: defaultOptions?.isInternal,
    }),
    headers: {
      "x-internal-request-secret": defaultOptions?.isInternal
        ? defaultOptions.internal_requestSecret
        : undefined,
    },
  });
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

export const handleKyError = async (
  error: HTTPError
): Promise<ErrorResponse> => {
  switch (error.name) {
    case "HTTPError": {
      const { response } = error;
      if (response?.body) {
        try {
          return (await error.response.clone().json()) as ErrorResponse;
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
    case "AbortError": {
      return {
        code: "abort error",
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
