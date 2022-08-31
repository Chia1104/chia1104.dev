import type { FC, DetailedHTMLProps, HTMLAttributes, ReactNode } from "react";

interface MDXHrProps
  extends DetailedHTMLProps<HTMLAttributes<HTMLHRElement>, HTMLHRElement> {
  children?: ReactNode;
}

export const MDXHr: FC<MDXHrProps> = (MDXHrProps) => {
  const { children, ...rest } = MDXHrProps;
  return (
    <>
      <hr {...rest} className="my-10 border-t-2 c-border-primary">
        {children}
      </hr>
    </>
  );
};
