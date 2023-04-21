"use client";

import React, {
  type DetailedHTMLProps,
  type FC,
  type HTMLAttributes,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from "react";

export const MDXTable: FC<
  DetailedHTMLProps<TableHTMLAttributes<HTMLTableElement>, HTMLTableElement>
> = ({ children, ...rest }) => {
  return (
    <table {...rest} className="my-5 w-full table-auto border-collapse">
      {children}
    </table>
  );
};

export const MDXThead: FC<
  DetailedHTMLProps<
    HTMLAttributes<HTMLTableSectionElement>,
    HTMLTableSectionElement
  >
> = ({ children, ...rest }) => {
  return (
    <thead {...rest} className="border p-2">
      {children}
    </thead>
  );
};

export const MDXTBody: FC<
  DetailedHTMLProps<
    TableHTMLAttributes<HTMLTableSectionElement>,
    HTMLTableSectionElement
  >
> = ({ children, ...rest }) => {
  return (
    <tbody {...rest} className="p-2">
      {children}
    </tbody>
  );
};

export const MDXTr: FC<
  DetailedHTMLProps<HTMLAttributes<HTMLTableRowElement>, HTMLTableRowElement>
> = ({ children, ...rest }) => {
  return (
    <tr {...rest} className="border-y p-2">
      {children}
    </tr>
  );
};

export const MDXTh: FC<
  DetailedHTMLProps<
    ThHTMLAttributes<HTMLTableHeaderCellElement>,
    HTMLTableHeaderCellElement
  >
> = ({ children, ...rest }) => {
  return (
    <th {...rest} className="p-2 text-start">
      {children}
    </th>
  );
};

export const MDXTd: FC<
  DetailedHTMLProps<
    TdHTMLAttributes<HTMLTableDataCellElement>,
    HTMLTableDataCellElement
  >
> = ({ children, ...rest }) => {
  return (
    <td {...rest} className="p-2">
      {children}
    </td>
  );
};
