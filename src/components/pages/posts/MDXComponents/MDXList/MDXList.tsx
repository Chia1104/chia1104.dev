import { type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  type?: string;
}

export const MDXUl: FC<Props> = (props) => {
  return (
    <>
      <ul {...props} className="p-3 list-disc pl-5 leading-loose">
        {props.children}
      </ul>
    </>
  );
};

export const MDXOl: FC<Props> = (props) => {
  return (
    <>
      <ol className="p-3 list-decimal pl-5">{props.children}</ol>
    </>
  );
};

export const MDXListItem: FC<Props> = (props) => {
  return (
    <>
      <li {...props} className="">
        {props.children}
      </li>
    </>
  );
};
