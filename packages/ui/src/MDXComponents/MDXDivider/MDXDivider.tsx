"use client";

import type { FC, DetailedHTMLProps, HTMLAttributes } from "react";

export const MDXHr: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement>
> = (MDXHrProps) => {
  const { children, ...rest } = MDXHrProps;
  return (
    <hr {...rest} className="c-border-primary my-10 border-t-2">
      {children}
    </hr>
  );
};
