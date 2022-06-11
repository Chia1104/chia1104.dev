import {DetailedHTMLProps, HTMLAttributes, useRef, useEffect, useState} from 'react';

export const H1 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    const r = useRef<HTMLHeadingElement>(null);
    const [mount, setMount] = useState(false);
    useEffect(() => {
        setMount(true);
        return () => setMount(false);
    }, []);

    return (
        <span className="inline-flex items-center group my-5 pb-5 border-b-2 c-border-primary w-full">
            <h1 {...props} className="text-5xl font-medium mr-2" ref={r}/>
            {
                mount &&
                <a
                    href={`#${r.current?.id}`}
                    className="c-text-secondary font-medium hidden group-hover:block"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </a>
            }
        </span>
    )
}
export const H2 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    const r = useRef<HTMLHeadingElement>(null);
    const [mount, setMount] = useState(false);
    useEffect(() => {
        setMount(true);
        return () => setMount(false);
    }, []);

    return (
        <span className="inline-flex items-center group my-4 w-full">
            <h2 {...props} className="text-4xl font-medium mr-2" ref={r}/>
            {
                mount &&
                <a
                    href={`#${r.current?.id}`}
                    className="c-text-secondary font-medium hidden group-hover:block"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </a>
            }
        </span>
    )
}
export const H3 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    const r = useRef<HTMLHeadingElement>(null);
    const [mount, setMount] = useState(false);
    useEffect(() => {
        setMount(true);
        return () => setMount(false);
    }, []);

    return (
        <span className="inline-flex items-center group my-3 w-full">
            <h3 {...props} className="text-3xl font-medium mr-2" ref={r}/>
            {
                mount &&
                <a
                    href={`#${r.current?.id}`}
                    className="c-text-secondary font-medium hidden group-hover:block"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </a>
            }
        </span>
    )
}
export const H4 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    const r = useRef<HTMLHeadingElement>(null);
    const [mount, setMount] = useState(false);
    useEffect(() => {
        setMount(true);
        return () => setMount(false);
    }, []);

    return (
        <span className="inline-flex items-center group my-2 w-full">
            <h4 {...props} className="text-2xl font-medium mr-2" ref={r}/>
            {
                mount &&
                <a
                    href={`#${r.current?.id}`}
                    className="c-text-secondary font-medium hidden group-hover:block"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </a>
            }
        </span>
    )
}
export const H5 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    const r = useRef<HTMLHeadingElement>(null);
    const [mount, setMount] = useState(false);
    useEffect(() => {
        setMount(true);
        return () => setMount(false);
    }, []);

    return (
        <span className="inline-flex items-center group w-full my-2">
            <h5 {...props} className="text-xl font-medium mr-2" ref={r}/>
            {
                mount &&
                <a
                    href={`#${r.current?.id}`}
                    className="c-text-secondary font-medium hidden group-hover:block"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                </a>
            }
        </span>
    )
}
export const H6 = (props: DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>) => {
    return <h6 {...props} className="text-lg my-2 font-medium"/>
}
