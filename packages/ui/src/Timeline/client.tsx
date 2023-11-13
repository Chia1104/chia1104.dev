"use client";

import React, { type FC } from "react";
import { motion } from "framer-motion";
import type { ListItemProps, ListProps } from "./types";
import { cn } from "../utils";

export const Year: FC<{
  year: string | number;
  className?: string;
}> = ({ year, className }) => {
  return (
    <div className={cn("rounded-lg p-1 text-[8em]", className)}>{year}</div>
  );
};

export const Item: FC<ListItemProps> = ({ data, className, ...props }) => (
  <motion.li className={cn("flex text-start", className)} {...props}>
    <span>{data.title}</span>
    <span>{data.subtitle}</span>
    {data.content && <span>{data.content}</span>}
  </motion.li>
);

export const List: FC<ListProps> = ({ year, data, className, ...props }) => (
  <motion.ul className={cn("relative", className)} {...props}>
    <Year year={year} className="absolute -top-4 left-4" />
    {data.map((item) => (
      <Item key={item.id} data={item} />
    ))}
  </motion.ul>
);
