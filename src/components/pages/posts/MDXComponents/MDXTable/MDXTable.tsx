import type {
  FC,
  ReactNode,
  DetailedHTMLProps,
  TableHTMLAttributes,
  ThHTMLAttributes,
  TdHTMLAttributes,
} from "react";

interface MDXTableProps
  extends DetailedHTMLProps<
    TableHTMLAttributes<HTMLTableElement>,
    HTMLTableElement
  > {
  children: ReactNode;
}

export const MDXTable: FC<MDXTableProps> = (MDXTableProps) => {
  const { children, ...rest } = MDXTableProps;
  return (
    <>
      <table
        {...rest}
        className="table-auto border-collapse border border-slate-500">
        {children}
      </table>
    </>
  );
};

interface MDXTHProps
  extends DetailedHTMLProps<
    ThHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  > {
  children: ReactNode;
}

export const MDXTh: FC<MDXTHProps> = (MDXTHProps) => {
  const { children, ...rest } = MDXTHProps;
  return (
    <>
      <th {...rest} className="p-2 border border-slate-500">
        {children}
      </th>
    </>
  );
};

interface MDXTDProps
  extends DetailedHTMLProps<
    TdHTMLAttributes<HTMLTableCellElement>,
    HTMLTableCellElement
  > {
  children: ReactNode;
}

export const MDXTd: FC<MDXTDProps> = (MDXTDProps) => {
  const { children, ...rest } = MDXTDProps;
  return (
    <>
      <td {...rest} className="p-2 border border-slate-500">
        {children}
      </td>
    </>
  );
};
