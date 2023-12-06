"use client";

import { type FC, type ReactNode } from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";

interface LinkProps {
  href: string | any;
  children: ReactNode;
}

const Link: FC<LinkProps & NextLinkProps> = (props) => {
  const { href, children, ...rest } = props;
  const isInternalLink = href.startsWith("/") || href.startsWith("#");

  if (isInternalLink) {
    return (
      <NextLink
        prefetch={false}
        passHref
        scroll
        {...rest}
        href={href}
        className="c-link text-info">
        {children}
      </NextLink>
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

export default Link;
