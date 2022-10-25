import { type FC, type ReactNode } from "react";
import NextLink from "next/link";
import type { LinkProps as NextLinkProps } from "next/link";

interface Props extends NextLinkProps {
  children: ReactNode;
  className?: string;
}

const Link: FC<Props> = (props) => {
  const { children, className, ...rest } = props;
  return (
    <div className={className}>
      <NextLink passHref scroll prefetch={false} {...rest}>
        {children}
      </NextLink>
    </div>
  );
};

export default Link;
