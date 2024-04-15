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
import { cn } from "../utils";
import dynamic from "next/dynamic";

const TransitionLink = dynamic(() =>
  import("next-view-transitions").then((mod) => mod.Link)
);

type InternalLinkProps = NextLinkProps & ComponentPropsWithoutRef<"a">;

interface LinkPropsWithoutPreview extends InternalLinkProps {
  href: string | any;
  children?: ReactNode;
  isInternalLink?: boolean;
  experimental?: {
    enableViewTransition?: boolean;
  };
}

type LinkProps =
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

interface PreviewProps {
  endpoint?: string;
  children?:
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

interface DocResponse {
  title?: string | null;
  description?: string | null;
  favicon?: string | null;
  ogImage?: string | null;
}

const previewSchema = z.strictObject({
  href: z.string().min(1),
});

type PreviewDTO = z.infer<typeof previewSchema>;

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
        <div className="bg-danger/30 z-[999] flex w-full max-w-60 items-center justify-center space-x-2 rounded-md px-1">
          <div className="text-danger i-mdi-alert ml-2 size-7" />
          <p className="pr-2">{callbackError ?? "Failed to fetch preview"}</p>
        </div>
      ) : !!data && isSuccess ? (
        <div className="flex min-w-0 flex-col gap-3">
          {data.ogImage && (
            <div className="not-prose aspect-h-9 aspect-w-16 relative w-60 overflow-hidden rounded-md">
              <img
                className="not-prose w-full rounded-md bg-neutral-200 object-cover p-0 dark:bg-neutral-800"
                src={data.ogImage}
                alt={data.title ?? "og-image"}
              />
            </div>
          )}
          <div
            className={cn(
              "flex max-w-60 items-center justify-start",
              (data.title || data.description) && "gap-x-4"
            )}>
            <Avatar>
              <AvatarImage src={data.favicon ?? ""} />
              <AvatarFallback>FI</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h4 className="mt-2 line-clamp-1 text-sm font-semibold">
                {data?.title}
              </h4>
              <p className="mb-0 line-clamp-3 text-sm">{data?.description}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="z-[999] flex flex-col gap-3">
          <div className="h-[120px] w-60 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-3 flex justify-between space-x-4">
            <div className="size-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
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
  preview,
  experimental,
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
      <HoverCardTrigger asChild className="z-10">
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
      <HoverCardContent
        className={cn(
          "z-20 w-full max-w-80 border-[#FCA5A5]/50 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
          isError &&
            "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]"
        )}>
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
    experimental,
    ...rest
  } = props;
  const isInternalLink =
    _isInternalLink ?? (href.startsWith("/") || href.startsWith("#"));

  if (isInternalLink && !preview && !experimental?.enableViewTransition) {
    return (
      <NextLink prefetch={false} passHref scroll {...rest} href={href}>
        {children}
      </NextLink>
    );
  } else if (isInternalLink && !preview && experimental?.enableViewTransition) {
    return (
      <TransitionLink passHref {...rest} href={href}>
        {children}
      </TransitionLink>
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
export type {
  LinkProps,
  LinkPropsWithoutPreview,
  NeverPreviewProps,
  PreviewProps,
  PreviewDTO,
  DocResponse,
};
export { previewSchema };
