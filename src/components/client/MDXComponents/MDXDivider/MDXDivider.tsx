"use client";

import type { FC, DetailedHTMLProps, HTMLAttributes } from "react";

export const MDXHr: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement>
> = (MDXHrProps) => {
  const { children, ...rest } = MDXHrProps;
  return (
    <>
      <hr {...rest} className="my-10 border-t-2 c-border-primary">
        {children}
      </hr>
    </>
  );
};
