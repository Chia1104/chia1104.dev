"use client";

import React, { type FC } from "react";
import { motion } from "framer-motion";
import type { ListItemProps, ListProps } from "./types";
import { cn } from "../utils";
import dayjs from "dayjs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../Accordion";

export const Year: FC<{
  year: string | number | dayjs.Dayjs;
  className?: string;
}> = ({ year, className }) => {
  return (
    <span
      className={cn("text-[5em] font-bold leading-3 opacity-20", className)}>
      {dayjs(year).format("YYYY")}
    </span>
  );
};

export const Item: FC<ListItemProps> = ({ data, className, ...props }) => {
  return (
    <motion.li
      whileInView={{
        opacity: 1,
        y: 0,
        transition: {
          duration: 0.5,
        },
      }}
      initial={{
        opacity: 0,
        y: 20,
      }}
      className={cn("flex flex-col text-start", className)}
      {...props}>
      <span>
        <span className="text-lg font-bold">{data.title}</span>{" "}
        <span className="text-sm text-gray-500">{data.subtitle}</span>
      </span>
      {data.content && (
        <Accordion
          type="single"
          collapsible
          className="w-full"
          defaultValue={data.id.toString()}>
          <AccordionItem
            value={data.id.toString()}
            className="prose-h3:m-1 prose-h3:w-fit">
            <AccordionTrigger className="flex w-fit p-0 text-sm text-gray-500 dark:text-gray-300">
              MORE
            </AccordionTrigger>
            <AccordionContent className="">{data.content}</AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </motion.li>
  );
};

export const List: FC<ListProps> = ({ year, data, className, ...props }) => (
  <motion.ul
    className={cn("relative flex flex-col gap-1", className)}
    {...props}>
    <Year year={year} className="absolute -top-4 left-0" />
    {data.map((item) => (
      <Item key={item.id} data={item} />
    ))}
  </motion.ul>
);
