import { FC, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export const MDXParagraph: FC<Props> = ({ children }) => {
  return <p className="text-base leading-loose">{children}</p>;
};

export const MDXStrong: FC<Props> = ({ children }) => {
  return (
    <strong className="text-base leading-loose font-bold c-text-bg-info-half">
      {children}
    </strong>
  );
};
