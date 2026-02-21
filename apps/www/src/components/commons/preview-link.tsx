"use client";

import type { LinkProps as NextLinkProps } from "next/link";
import Link from "next/link";
import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { useState } from "react";

import type { UseQueryResult, UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

import { Avatar, AvatarFallback, AvatarImage } from "@chia/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@chia/ui/hover-card";
import { cn } from "@chia/ui/utils/cn.util";
import { isUrl } from "@chia/utils/is";

import type { HonoRPCError } from "@/libs/service/error";
import type { LinkPreviewResponse } from "@/services/toolings.service";
import { getLinkPreview } from "@/services/toolings.service";

const HOVER_CARD_STYLES = {
  base: "z-20 w-full max-w-80 border-[#FCA5A5]/50 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
  error:
    "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]",
};

type InternalLinkProps = NextLinkProps &
  Omit<ComponentPropsWithoutRef<"a">, "href">;

export interface PreviewLinkProps extends Omit<
  InternalLinkProps,
  "children" | "locale"
> {
  href: URL | string;
  children?:
    | ReactNode
    | ((
        result: UseQueryResult<LinkPreviewResponse, HonoRPCError>
      ) => ReactNode);
  previewContent?:
    | ReactNode
    | ((
        result: UseQueryResult<LinkPreviewResponse, HonoRPCError>
      ) => ReactNode);
  queryOptions?: Omit<
    UseQueryOptions<LinkPreviewResponse, HonoRPCError>,
    "queryKey" | "queryFn" | "enabled"
  >;
  enabled?: boolean;
}

export const previewSchema = z.strictObject({
  href: z.string().min(1),
});

export type PreviewDTO = z.infer<typeof previewSchema>;

const PreviewError = ({ message }: { message: string | null }) => (
  <div className="bg-danger/30 z-999 flex w-full max-w-60 items-center justify-center space-x-2 rounded-md px-1">
    <div className="text-danger i-mdi-alert ml-2 size-7" />
    <span className="pr-2">{message ?? "Failed to fetch preview"}</span>
  </div>
);

const PreviewSkeleton = () => (
  <div className="z-999 flex flex-col gap-3">
    <div className="h-[120px] w-60 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
    <div className="mt-3 flex items-center space-x-4">
      <span className="size-10 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
      <div className="flex flex-col space-y-2">
        <span className="h-3 w-40 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
        <span className="h-3 w-30 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
      </div>
    </div>
  </div>
);

const PreviewContent = ({ data }: { data: LinkPreviewResponse }) => {
  const hasContent = data.title ?? data.description;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {data.ogImage && (
        <div className="not-prose relative aspect-video w-60 overflow-hidden rounded-md">
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
          hasContent && "gap-x-4"
        )}>
        <Avatar>
          <AvatarImage src={data.favicon ?? ""} />
          <AvatarFallback>FI</AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          {data.title && (
            <span className="mt-2 line-clamp-1 text-sm font-semibold">
              {data.title}
            </span>
          )}
          {data.description && (
            <span className="mb-0 line-clamp-3 text-sm">
              {data.description}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

const PreviewDetail = ({
  data,
  isError,
  isSuccess,
  error,
}: Pick<
  UseQueryResult<LinkPreviewResponse, HonoRPCError>,
  "data" | "isSuccess" | "isError" | "error"
>) => {
  if (isError) {
    return (
      <PreviewError message={error?.message ?? "Failed to fetch preview"} />
    );
  }

  if (data && isSuccess) {
    return <PreviewContent data={data} />;
  }

  return <PreviewSkeleton />;
};

const useLinkPreview = (
  href: URL | string,
  isOpen: boolean,
  queryOptions?: Omit<
    UseQueryOptions<LinkPreviewResponse, HonoRPCError>,
    "queryKey" | "queryFn" | "enabled"
  >,
  enabled?: boolean
) => {
  return useQuery<LinkPreviewResponse, HonoRPCError>({
    queryKey: ["link-preview", { href: href.toString() }],
    queryFn: async ({ signal }) => {
      return await getLinkPreview(href.toString(), signal);
    },
    enabled: isOpen && isUrl(href) && enabled,
    retry: 1,
    ...queryOptions,
  });
};

/**
 * PreviewLink 元件 - 提供連結預覽功能的懸浮卡片
 *
 * @example
 * ```tsx
 * <PreviewLink href="https://example.com">
 *   查看連結
 * </PreviewLink>
 * ```
 */
const PreviewLink = ({
  queryOptions,
  previewContent,
  children,
  href,
  enabled = true,
  ...props
}: PreviewLinkProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const result = useLinkPreview(href, isOpen, queryOptions, enabled);

  const renderPreviewContent = () => {
    if (previewContent) {
      return typeof previewContent === "function"
        ? previewContent(result)
        : previewContent;
    }

    return (
      <PreviewDetail
        data={result.data}
        isError={result.isError}
        isSuccess={result.isSuccess}
        error={result.error}
      />
    );
  };

  return (
    <HoverCard onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild className="z-10">
        <Link
          target="_blank"
          rel="noopener noreferrer"
          {...props}
          href={href.toString()}>
          {typeof children === "function" ? children(result) : children}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent
        className={cn(
          HOVER_CARD_STYLES.base,
          result.isError && HOVER_CARD_STYLES.error
        )}>
        {renderPreviewContent()}
      </HoverCardContent>
    </HoverCard>
  );
};

export default PreviewLink;
