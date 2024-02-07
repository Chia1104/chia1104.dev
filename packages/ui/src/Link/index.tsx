"use client";

import {
  type FC,
  type ReactNode,
  useState,
  type ComponentPropsWithoutRef,
  useEffect,
} from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../HoverCard";
import { Avatar, AvatarFallback, AvatarImage } from "../Avatar";
import {
  useQuery,
  type UseQueryResult,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { post, isUrl, handleKyError } from "@chia/utils";
import { z } from "zod";
import { HTTPError } from "ky";

type InternalLinkProps = NextLinkProps & ComponentPropsWithoutRef<"a">;

export interface LinkPropsWithoutPreview extends InternalLinkProps {
  href: string | any;
  children: ReactNode;
  isInternalLink?: boolean;
}

export type LinkProps =
  | (LinkPropsWithoutPreview & {
      preview?: false | undefined;
    } & NeverPreviewProps)
  | (Omit<LinkPropsWithoutPreview, "children"> & {
      preview: true;
    } & PreviewProps);

interface NeverPreviewProps {
  endpoint?: never;
  previewContent?: never;
  queryOptions?: never;
}

export interface PreviewProps {
  endpoint?: string;
  children:
    | ReactNode
    | ((result: UseQueryResult<DocResponse, HTTPError>) => ReactNode);
  previewContent?:
    | ReactNode
    | ((result: UseQueryResult<DocResponse, HTTPError>) => ReactNode);
  queryOptions?: Omit<
    UseQueryOptions<DocResponse, HTTPError>,
    "queryKey" | "queryFn" | "enabled"
  >;
}

export interface DocResponse {
  title?: string | null;
  description?: string | null;
  favicon?: string | null;
  ogImage?: string | null;
}

export const previewSchema = z.strictObject({
  href: z.string().min(1),
});

export type PreviewDTO = z.infer<typeof previewSchema>;

const PreviewDetail: FC<
  Pick<
    UseQueryResult<DocResponse, HTTPError>,
    "data" | "isSuccess" | "isError" | "error"
  >
> = ({ data, isError, isSuccess, error }) => {
  const [callbackError, setCallbackError] = useState<string | null>(null);
  useEffect(() => {
    const handleError = async (error: HTTPError) => {
      return (await handleKyError(error)).code;
    };
    if (isError && !!error) {
      handleError(error).then(setCallbackError);
    }
  }, [isError, error]);

  return (
    <>
      {isError ? (
        <div className="bg-danger/30 z-[999] flex w-full max-w-60 items-center justify-center space-x-2 rounded-md p-1">
          <div className="text-danger i-mdi-alert ml-2 h-7 w-7" />
          <p className="pr-2">{callbackError ?? "Failed to fetch preview"}</p>
        </div>
      ) : !!data && isSuccess ? (
        <div className="z-[999] flex flex-col gap-3">
          {data.ogImage && (
            <div className="not-prose aspect-h-9 aspect-w-16 relative w-60 overflow-hidden rounded-md">
              <img
                className=" not-prose rounded-md bg-neutral-200 object-cover p-0 dark:bg-neutral-800"
                src={data.ogImage}
                alt={data.title ?? "og-image"}
              />
            </div>
          )}
          <div className="flex items-center justify-start space-x-4">
            <Avatar>
              <AvatarImage src={data.favicon ?? ""} />
              <AvatarFallback>FI</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">{data?.title}</h4>
              <p className="line-clamp-3 text-sm">{data?.description}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="z-[999] flex flex-col gap-3">
          <div className="h-[120px] w-60 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="flex justify-between space-x-4">
            <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="space-y-1">
              <div className="h-4 w-40 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
              <div className="h-4 w-40 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const PreviewCard: FC<LinkProps & { preview: true }> = ({
  queryOptions,
  previewContent,
  children,
  href,
  endpoint = "/api/v1/link-preview",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, isError, isSuccess, error, ...rest } = useQuery<
    DocResponse,
    HTTPError
  >({
    retry: 1,
    ...queryOptions,
    queryKey: ["link-preview", { href }],
    queryFn: async ({ signal }) => {
      return await post<DocResponse, PreviewDTO>(
        endpoint,
        {
          href,
        },
        {
          signal,
        }
      );
    },
    enabled: isOpen && isUrl(href),
  });
  return (
    <HoverCard onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild>
        <a target="_blank" rel="noopener noreferrer" {...props} href={href}>
          {typeof children === "function"
            ? // @ts-expect-error
              children({
                data,
                isLoading,
                isError,
                isSuccess,
                error,
                ...rest,
              })
            : children}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="z-[999] w-full max-w-80">
        {!!previewContent ? (
          typeof previewContent === "function" ? (
            // @ts-expect-error
            previewContent({
              data,
              isLoading,
              isError,
              isSuccess,
              error,
              ...rest,
            })
          ) : (
            previewContent
          )
        ) : (
          <PreviewDetail
            data={data}
            isError={isError}
            isSuccess={isSuccess}
            error={error}
          />
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

const Link: FC<LinkProps> = (props) => {
  const {
    href,
    children,
    isInternalLink: _isInternalLink,
    preview,
    ...rest
  } = props;
  const isInternalLink =
    _isInternalLink ?? (href.startsWith("/") || href.startsWith("#"));

  if (isInternalLink && !preview) {
    return (
      <NextLink prefetch={false} passHref scroll {...rest} href={href}>
        {children}
      </NextLink>
    );
  } else if (preview && isUrl(href)) {
    return <PreviewCard {...props} />;
  } else if (!preview) {
    return (
      <a target="_blank" rel="noopener noreferrer" {...rest} href={href}>
        {children}
      </a>
    );
  }
};

export default Link;
