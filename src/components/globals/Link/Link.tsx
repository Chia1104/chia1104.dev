import { FC, ReactNode, memo } from 'react';
import NextLink from 'next/link';
import type { LinkProps as NextLinkProps } from 'next/link';

interface Props extends NextLinkProps {
    children: ReactNode;
}

const Link: FC<Props> = ({ children, ...props }) => {
    return (
        <NextLink
            passHref
            scroll
            prefetch={false}
            {...props}
        >
            {children}
        </NextLink>
    );
}

export default memo(Link);
