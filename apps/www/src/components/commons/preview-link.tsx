"use client";

import type { LinkProps as NextLinkProps } from "next/link";
import Link from "next/link";
import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { useState } from "react";

import { Avatar, Tooltip } from "@heroui/react";
import type { UseQueryResult } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

import { cn } from "@chia/ui/utils/cn.util";
import { isUrl } from "@chia/utils/is";

import { orpc } from "@/libs/orpc/client";
import type { RouterOutputs } from "@/libs/orpc/types";

type LinkPreviewResponse = RouterOutputs["toolings"]["link-preview"];

const linkPreview = orpc.toolings["link-preview"];

const PREVIEW_STYLES = {
  base: "z-20 w-80 border border-[#FCA5A5]/50 p-4 text-sm break-normal shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]",
  error:
    "border-danger/50 dark:border-danger/50 shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)] dark:shadow-[0px_0px_25px_4px_rgb(244_67_54_/_0.3)]",
};

type InternalLinkProps = NextLinkProps &
  Omit<ComponentPropsWithoutRef<"a">, "href">;

type LinkPreviewQueryOptions = Parameters<
  typeof linkPreview.queryOptions<LinkPreviewResponse>
>[0];

export interface PreviewLinkProps extends Omit<
  InternalLinkProps,
  "children" | "locale"
> {
  href: URL | string;
  children?:
    | ReactNode
    | ((result: UseQueryResult<LinkPreviewResponse, Error>) => ReactNode);
  previewContent?:
    | ReactNode
    | ((result: UseQueryResult<LinkPreviewResponse, Error>) => ReactNode);
  queryOptions?: LinkPreviewQueryOptions;
  enabled?: boolean;
}

export const previewSchema = z.strictObject({
  href: z.string().min(1),
});

export type PreviewDTO = z.infer<typeof previewSchema>;

const PreviewError = ({ message }: { message: string | null }) => (
  <div className="bg-danger/30 z-999 flex w-full items-center justify-center space-x-2 rounded-md px-1">
    <div className="text-danger i-mdi-alert ml-2 size-7" />
    <span className="pr-2">{message ?? "Failed to fetch preview"}</span>
  </div>
);

const PreviewSkeleton = () => (
  <div className="z-999 flex w-full flex-col gap-3">
    <div className="aspect-video w-full animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
    <div className="mt-3 flex items-center space-x-4">
      <span className="size-10 shrink-0 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
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
    <div className="flex w-full min-w-0 flex-col gap-3">
      {data.ogImage && (
        <div className="not-prose relative aspect-video w-full overflow-hidden rounded-md bg-neutral-200 dark:bg-neutral-800">
          <img
            className="not-prose absolute inset-0 size-full rounded-md object-cover p-0"
            src={data.ogImage}
            alt={data.title ?? "og-image"}
          />
        </div>
      )}
      <div
        className={cn(
          "flex w-full items-center justify-start",
          hasContent && "gap-x-4"
        )}>
        <Avatar className="shrink-0">
          <Avatar.Image src={data.favicon ?? ""} />
          <Avatar.Fallback>FI</Avatar.Fallback>
        </Avatar>
        <div className="flex min-w-0 flex-col gap-1">
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
  UseQueryResult<LinkPreviewResponse, Error>,
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
  queryOptions?: LinkPreviewQueryOptions,
  enabled?: boolean
) => {
  return useQuery(
    linkPreview.queryOptions({
      ...queryOptions,
      input: { href: href.toString() },
      enabled: isOpen && isUrl(href) && enabled,
      retry: 1,
    })
  );
};

const PreviewLink = ({
  queryOptions,
  previewContent,
  children,
  href,
  className,
  enabled = true,
  ...props
}: PreviewLinkProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const result = useLinkPreview(href, isOpen, queryOptions, enabled);

  const renderPreviewContent = () => {
    if (previewContent) {
      return previewContent instanceof Function
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
    <Tooltip delay={300} onOpenChange={setIsOpen}>
      <Tooltip.Trigger<"a">
        className={cn("z-10", className)}
        render={(triggerProps) => (
          <Link
            target="_blank"
            rel="noopener noreferrer"
            {...props}
            {...triggerProps}
            /* SAFETY: the trigger is an anchor, so its implicit link role must survive HeroUI's button role. */
            role={undefined}
            href={href.toString()}>
            {children instanceof Function ? children(result) : children}
          </Link>
        )}
      />
      <Tooltip.Content
        className={cn(
          PREVIEW_STYLES.base,
          result.isError && PREVIEW_STYLES.error
        )}>
        {renderPreviewContent()}
      </Tooltip.Content>
    </Tooltip>
  );
};

export default PreviewLink;
