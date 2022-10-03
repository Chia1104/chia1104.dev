import type { FC, DetailedHTMLProps, HTMLAttributes } from "react";

export const MDXParagraph: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLParagraphElement>, HTMLParagraphElement>
> = ({ children }) => {
  return <p className="text-base leading-loose">{children}</p>;
};

export const MDXStrong: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>
> = ({ children }) => {
  return (
    <strong className="text-base leading-loose font-bold c-text-bg-info-half">
      {children}
    </strong>
  );
};
