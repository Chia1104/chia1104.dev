"use client";

import React, {
  type FC,
  type LiHTMLAttributes,
  type DetailedHTMLProps,
  type HTMLAttributes,
  type OlHTMLAttributes,
} from "react";

export const MDXUl: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLUListElement>, HTMLUListElement>
> = (MDXUlProps) => {
  const { children, ...rest } = MDXUlProps;
  return (
    <ul {...rest} className="list-disc p-3 pl-5 leading-loose">
      {children}
    </ul>
  );
};

export const MDXOl: FC<
  DetailedHTMLProps<OlHTMLAttributes<HTMLOListElement>, HTMLOListElement>
> = (MDXOlProps) => {
  const { children, ...rest } = MDXOlProps;
  return (
    <ol className="list-decimal p-3 pl-5" {...rest}>
      {children}
    </ol>
  );
};

export const MDXListItem: FC<
  DetailedHTMLProps<LiHTMLAttributes<HTMLLIElement>, HTMLLIElement>
> = (MDXLiProps) => {
  const { children, ...rest } = MDXLiProps;
  return (
    <li {...rest} className="">
      {children}
    </li>
  );
};
