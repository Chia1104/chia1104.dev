"use client";

import {
  type FC,
  type DetailedHTMLProps,
  type HTMLAttributes,
  useRef,
} from "react";
import useIsMounted from "../../utils/use-is-mounted";

export const H1: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const isMounted = useIsMounted();

  return (
    <div className="c-border-primary group my-5 inline-flex w-full items-center border-b-2 pb-5">
      <h1 {...rest} className="mr-2 text-4xl font-bold" ref={r}>
        {children}
      </h1>
      {isMounted && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary block font-medium group-hover:block md:hidden">
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
    </div>
  );
};
export const H2: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const isMounted = useIsMounted();

  return (
    <div className="group my-4 inline-flex w-full items-center">
      <h2 {...rest} className="mr-2 text-3xl font-bold" ref={r}>
        {children}
      </h2>
      {isMounted && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary block font-medium group-hover:block md:hidden">
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
    </div>
  );
};
export const H3: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const isMounted = useIsMounted();

  return (
    <div className="group my-3 inline-flex w-full items-center">
      <h3 {...rest} className="mr-2 text-2xl font-bold" ref={r}>
        {children}
      </h3>
      {isMounted && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary block font-medium group-hover:block md:hidden">
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
    </div>
  );
};
export const H4: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const isMounted = useIsMounted();

  return (
    <div className="group my-2 inline-flex w-full items-center">
      <h4 {...rest} className="mr-2 text-xl font-bold" ref={r}>
        {children}
      </h4>
      {isMounted && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary block font-medium group-hover:block md:hidden">
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
    </div>
  );
};
export const H5: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  const r = useRef<HTMLHeadingElement>(null);
  const isMounted = useIsMounted();

  return (
    <div className="group my-2 inline-flex w-full items-center">
      <h5 {...rest} className="mr-2 text-lg font-bold" ref={r}>
        {children}
      </h5>
      {isMounted && (
        <a
          href={`#${r.current?.id}`}
          aria-label={r.current?.innerText}
          className="c-text-secondary block font-medium group-hover:block md:hidden">
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
    </div>
  );
};
export const H6: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHeadingElement>, HTMLHeadingElement>
> = (MDXHeadingProps) => {
  const { children, ...rest } = MDXHeadingProps;

  return (
    <h6 {...rest} className="my-2 text-lg font-medium">
      {children}
    </h6>
  );
};
