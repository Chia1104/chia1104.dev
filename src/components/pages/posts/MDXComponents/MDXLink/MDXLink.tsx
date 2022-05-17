import Link from 'next/link';

export const MDXLink = (props: any) => {
    const href = props.href;
    const isInternalLink = href && (href.startsWith('/') || href.startsWith('#'));

    if (isInternalLink) {
        return (
            <Link href={href}>
                <a {...props} className="link link-underline link-underline-black text-info">{props.children}</a>
            </Link>
        );
    }

    return <a target="_blank" rel="noopener noreferrer" {...props} className="link link-underline link-underline-black text-info"/>;
}

