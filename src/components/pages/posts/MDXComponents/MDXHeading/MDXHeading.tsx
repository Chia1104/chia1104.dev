import {
  type FC,
  type ReactNode,
  type DetailedHTMLProps,
  type HTMLAttributes,
  useRef,
  useEffect,
  useState,
} from "react";

interface MDXHeadingProps
  extends DetailedHTMLProps<
    HTMLAttributes<HTMLHeadingElement>,
    HTMLHeadingElement
  > {
  children?: ReactNode;
}

export const H1: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const [mount, setMount] = useState(false);

  useEffect(() => {
    setMount(true);
    return () => setMount(false);
  }, []);

  return (
    <span className="inline-flex items-center group my-5 pb-5 border-b-2 c-border-primary w-full">
      <h1 {...rest} className="text-4xl font-bold mr-2" ref={r}>
        {children}
      </h1>
      {mount && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary font-medium hidden group-hover:block">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </a>
      )}
    </span>
  );
};
export const H2: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setMount(true);
    return () => setMount(false);
  }, []);

  return (
    <span className="inline-flex items-center group my-4 w-full">
      <h2 {...rest} className="text-3xl font-bold mr-2" ref={r}>
        {children}
      </h2>
      {mount && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary font-medium hidden group-hover:block">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </a>
      )}
    </span>
  );
};
export const H3: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setMount(true);
    return () => setMount(false);
  }, []);

  return (
    <span className="inline-flex items-center group my-3 w-full">
      <h3 {...rest} className="text-2xl font-bold mr-2" ref={r}>
        {children}
      </h3>
      {mount && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary font-medium hidden group-hover:block">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </a>
      )}
    </span>
  );
};
export const H4: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setMount(true);
    return () => setMount(false);
  }, []);

  return (
    <span className="inline-flex items-center group my-2 w-full">
      <h4 {...rest} className="text-xl font-bold mr-2" ref={r}>
        {children}
      </h4>
      {mount && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary font-medium hidden group-hover:block">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </a>
      )}
    </span>
  );
};
export const H5: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const [mount, setMount] = useState(false);
  useEffect(() => {
    setMount(true);
    return () => setMount(false);
  }, []);

  return (
    <span className="inline-flex items-center group w-full my-2">
      <h5 {...rest} className="text-lg font-bold mr-2" ref={r}>
        {children}
      </h5>
      {mount && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary font-medium hidden group-hover:block">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
            />
          </svg>
        </a>
      )}
    </span>
  );
};
export const H6: FC<MDXHeadingProps> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  return (
    <h6 {...rest} className="text-lg my-2 font-medium">
      {children}
    </h6>
  );
};
