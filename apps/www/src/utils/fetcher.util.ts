import setSearchParams from "./set-search-params.util";
import { errorConfig } from "@/config/network.config";

/**
 * @deprecated
 */
export enum ApiResponseStatus {
  SUCCESS = "success",
  ERROR = "error",
}

/**
 * @deprecated use `ky` instead
 */
interface IApiResponse<T = unknown> {
  statusCode: number;
  status: ApiResponseStatus;
  data?: T;
  message?: string;
}

/**
 * @deprecated use `ky` instead
 */
interface IFetcherOptions {
  requestInit?: RequestInit;
  endpoint?: string;
  params?: Partial<Record<string, string>>;
  path?: string;
  dangerousThrow?: boolean;
}

const getErrorMessages = (statusCode: number): string => {
  return (
    errorConfig[statusCode as keyof typeof errorConfig] ?? errorConfig[500]
  );
};

/**
 * @deprecated use `ky` instead
 */
const fetcher = async <T = unknown>(
  options: IFetcherOptions
): Promise<IApiResponse<T>> => {
  const { requestInit = {}, endpoint, params, path, dangerousThrow } = options;
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
      if (dangerousThrow) {
        throw new Error(_data?.message ?? getErrorMessages(res.status));
      }
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
    if (e instanceof DOMException && dangerousThrow) {
      throw new Error("You have aborted the request.");
    }
    if (e instanceof Error && dangerousThrow) {
      throw new Error(e.message);
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
