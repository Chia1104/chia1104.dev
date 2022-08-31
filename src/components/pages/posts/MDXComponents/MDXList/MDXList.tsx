import type { FC, ReactNode, HTMLAttributes } from "react";

interface MDXUlProps extends HTMLAttributes<HTMLUListElement> {
  children: ReactNode;
}

export const MDXUl: FC<MDXUlProps> = (MDXUlProps) => {
  const { children, ...rest } = MDXUlProps;
  return (
    <>
      <ul {...rest} className="p-3 list-disc pl-5 leading-loose">
        {children}
      </ul>
    </>
  );
};

interface MDXOlProps extends HTMLAttributes<HTMLOListElement> {
  children: ReactNode;
}

export const MDXOl: FC<MDXOlProps> = (MDXOlProps) => {
  const { children, ...rest } = MDXOlProps;
  return (
    <>
      <ol className="p-3 list-decimal pl-5" {...rest}>
        {children}
      </ol>
    </>
  );
};

interface MDXLiProps extends HTMLAttributes<HTMLLIElement> {
  children: ReactNode;
}

export const MDXListItem: FC<MDXLiProps> = (MDXLiProps) => {
  const { children, ...rest } = MDXLiProps;
  return (
    <>
      <li {...rest} className="">
        {children}
      </li>
    </>
  );
};
