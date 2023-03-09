import setSearchParams from "./set-search-params.util";
import { errorConfig } from "@chia/config/network.config";

export enum ApiResponseStatus {
  SUCCESS = "success",
  ERROR = "error",
}

interface IApiResponse<T = unknown> {
  statusCode: number;
  status: ApiResponseStatus;
  data?: T;
  message?: string;
}

interface IFetcherOptions {
  requestInit?: RequestInit;
  endpoint?: string;
  params?: Partial<Record<string, string>>;
  path?: string;
}

const getErrorMessages = (statusCode: number): string => {
  return (
    errorConfig[statusCode as keyof typeof errorConfig] ?? errorConfig[500]
  );
};

const fetcher = async <T = unknown>(
  options: IFetcherOptions
): Promise<IApiResponse<T>> => {
  const { requestInit = {}, endpoint, params, path } = options;
  const searchParams = setSearchParams({
    searchParams: {
      ...(params ?? {}),
    },
  });
  try {
    const res = await fetch(
      `${endpoint ?? ""}${path ?? ""}${searchParams && `?${searchParams}`}`,
      {
        ...requestInit,
        headers: {
          ...requestInit["headers"],
        },
      }
    );
    if (res.status === 204) {
      return {
        statusCode: 204,
        status: ApiResponseStatus.SUCCESS,
      } satisfies Pick<IApiResponse, "statusCode" | "status">;
    }
    const _data = (await res.json()) as IApiResponse<T>;
    if (!res.ok && _data?.status !== ApiResponseStatus.SUCCESS) {
      return {
        statusCode: res.status ?? 400,
        status: ApiResponseStatus.ERROR,
        message:
          _data?.message ??
          getErrorMessages(res.status as keyof typeof errorConfig),
      } satisfies Pick<IApiResponse, "statusCode" | "status" | "message">;
    }
    return {
      statusCode: res.status,
      status: ApiResponseStatus.SUCCESS,
      data: _data?.data,
    } satisfies Pick<IApiResponse<T>, "statusCode" | "status" | "data">;
  } catch (e) {
    if (e instanceof AbortSignal) {
      return {
        statusCode: 408,
        status: ApiResponseStatus.ERROR,
        message: getErrorMessages(408),
      } satisfies Pick<IApiResponse, "statusCode" | "status" | "message">;
    }
    return {
      statusCode: 500,
      status: ApiResponseStatus.ERROR,
      message: getErrorMessages(500),
    } satisfies Pick<IApiResponse, "statusCode" | "status" | "message">;
  }
};

export { fetcher };
export type { IFetcherOptions, IApiResponse };
