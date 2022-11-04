"use client";

import type {
  FC,
  LiHTMLAttributes,
  DetailedHTMLProps,
  HTMLAttributes,
  OlHTMLAttributes,
} from "react";

export const MDXUl: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>
> = (MDXUlProps) => {
  const { children, ...rest } = MDXUlProps;
  return (
    <>
      <ul {...rest} className="p-3 list-disc pl-5 leading-loose">
        {children}
      </ul>
    </>
  );
};

export const MDXOl: FC<
  DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>
> = (MDXOlProps) => {
  const { children, ...rest } = MDXOlProps;
  return (
    <>
      <ol className="p-3 list-decimal pl-5" {...rest}>
        {children}
      </ol>
    </>
  );
};

export const MDXListItem: FC<
  DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>
> = (MDXLiProps) => {
  const { children, ...rest } = MDXLiProps;
  return (
    <>
      <li {...rest} className="">
        {children}
      </li>
    </>
  );
};
