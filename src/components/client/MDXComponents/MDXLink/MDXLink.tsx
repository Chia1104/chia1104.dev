"use client";

import Link from "next/link";
import type { FC, ReactNode } from "react";

interface MDXLinkProps {
  href: string | any;
  children: ReactNode;
}

export const MDXLink: FC<MDXLinkProps> = (MDXLinkProps) => {
  const { href, children, ...rest } = MDXLinkProps;
  const isInternalLink = href.startsWith("/") || href.startsWith("#");

  if (isInternalLink) {
    return (
      <Link
        prefetch={false}
        passHref
        scroll
        {...rest}
        href={href}
        className="c-link text-info">
        {children}
      </Link>
    );
  }

  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      href={href}
      {...rest}
      className="c-link text-info">
      {children}
    </a>
  );
};
