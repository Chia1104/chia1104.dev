import { type FC, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export const MDXTable: FC<Props> = (props) => {
  return (
    <>
      <table
        {...props}
        className="table-auto border-collapse border border-slate-500"
      >
        {props.children}
      </table>
    </>
  );
};

export const MDXTh: FC<Props> = (props) => {
  return (
    <>
      <th {...props} className="p-2 border border-slate-500">
        {props.children}
      </th>
    </>
  );
};

export const MDXTd: FC<Props> = (props) => {
  return (
    <>
      <td {...props} className="p-2 border border-slate-500">
        {props.children}
      </td>
    </>
  );
};
