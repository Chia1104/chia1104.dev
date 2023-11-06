"use client";

import { useQuery } from "@tanstack/react-query";
import { get, type HTTPError } from "@chia/utils";
import { ReactNode, type ComponentProps, type FC } from "react";
import { cn } from "@chia/ui";

type Data = {
  currentVisitors: number;
};

const CurrentVisitors: FC<
  Omit<ComponentProps<"span">, "children"> & {
    children?: ({
      data,
      isLoading,
      isSuccess,
      isError,
    }: {
      data?: Data;
      isLoading: boolean;
      isSuccess: boolean;
      isError: boolean;
      error: HTTPError | null;
    }) => ReactNode;
  }
> = ({ className, children, ...props }) => {
  const { data, isLoading, isSuccess, isError, error } = useQuery<
    Data,
    HTTPError
  >({
    queryKey: ["currentVisitors"],
    queryFn: () =>
      get<Data>("/api/v1/umami", undefined, {
        next: { revalidate: 5 * 60 },
      }),
    refetchInterval: 3 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  return (
    <span
      className={cn(
        "flex items-center justify-center gap-2 text-sm",
        className
      )}
      {...props}>
      <span className="relative flex h-3 w-3">
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
            isLoading && "bg-info",
            isSuccess && "bg-success",
            isError && "bg-warning"
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-3 w-3 rounded-full ",
            isLoading && "bg-info",
            isSuccess && "bg-success",
            isError && "bg-warning"
          )}
        />
      </span>
      {children?.({ data, isLoading, isSuccess, isError, error })}
    </span>
  );
};

export default CurrentVisitors;
