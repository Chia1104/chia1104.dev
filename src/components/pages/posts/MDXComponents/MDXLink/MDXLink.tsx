import Link from 'next/link';
import {FC, ReactNode} from 'react';

interface Props {
    href: string;
    children: ReactNode
}

export const MDXLink: FC<Props> = (props) => {
    const h = props.href;
    const isInternalLink = h && (h.startsWith('/') || h.startsWith('#'));

    if (isInternalLink) {
        return (
            <Link href={h}>
                <a {...props} className="link link-underline link-underline-black text-info">{props.children}</a>
            </Link>
        );
    }

    return <a target="_blank" rel="noopener noreferrer" {...props} className="link link-underline link-underline-black text-info"/>;
}

