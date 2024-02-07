"use client";

import {
  type FC,
  type ReactNode,
  useState,
  type ComponentPropsWithoutRef,
} from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "../HoverCard";
import { Avatar, AvatarFallback, AvatarImage } from "../Avatar";
import { useQuery } from "@tanstack/react-query";
import { post, isUrl } from "@chia/utils";
import { z } from "zod";

type InternalLinkProps = NextLinkProps & ComponentPropsWithoutRef<"a">;

export interface LinkProps extends InternalLinkProps {
  href: string | any;
  children: ReactNode;
  isInternalLink?: boolean;
}

export type LinkPropsWithPreview =
  | (LinkProps & {
      preview?: false | undefined;
    } & NeverPreviewProps)
  | (LinkProps & {
      preview: true;
    } & PreviewProps);

interface NeverPreviewProps {
  endpoint?: never;
}

export interface PreviewProps {
  endpoint?: string;
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

const PreviewCard: FC<LinkPropsWithPreview & { preview: true }> = ({
  children,
  href,
  endpoint = "/api/v1/link-preview",
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data, isLoading, isError, isSuccess } = useQuery<DocResponse>({
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
          {children}
        </a>
      </HoverCardTrigger>
      <HoverCardContent className="w-full max-w-80">
        {!!data && isSuccess && (
          <div className="flex justify-between space-x-4">
            {data.favicon && (
              <Avatar>
                <AvatarImage src={data?.favicon} />
                <AvatarFallback>FI</AvatarFallback>
              </Avatar>
            )}
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">{data?.title}</h4>
              <p className="text-sm">{data?.description}</p>
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

const Link: FC<LinkPropsWithPreview> = (props) => {
  const {
    href,
    children,
    isInternalLink: _isInternalLink,
    preview,
    ...rest
  } = props;
  const isInternalLink =
    _isInternalLink ?? (href.startsWith("/") || href.startsWith("#"));

  if (isInternalLink) {
    return (
      <NextLink prefetch={false} passHref scroll {...rest} href={href}>
        {children}
      </NextLink>
    );
  } else if (preview && isUrl(href)) {
    return <PreviewCard {...props} />;
  }

  return (
    <a target="_blank" rel="noopener noreferrer" {...rest} href={href}>
      {children}
    </a>
  );
};

export default Link;
