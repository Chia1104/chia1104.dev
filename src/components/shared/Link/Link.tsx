import { type FC, type ReactNode } from "react";
import NextLink, { type LinkProps as NextLinkProps } from "next/link";

interface Props extends NextLinkProps {
  children: ReactNode;
  outSideStyle?: string;
  className?: string;
}

const Link: FC<Props> = (props) => {
  const { children, outSideStyle, className, ...rest } = props;
  return (
    <div className={outSideStyle}>
      <NextLink className={className} {...rest}>
        {children}
      </NextLink>
    </div>
  );
};

export default Link;
