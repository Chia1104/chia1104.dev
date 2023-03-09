import { type FC, type ComponentProps } from "react";
import NextLink, { type LinkProps } from "next/link";

const Link: FC<LinkProps<HTMLAnchorElement> & ComponentProps<"a">> = (
  props
) => {
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
