"use client";

import type { FC } from "react";

import { CircularProgress } from "@heroui/react";
import { motion } from "framer-motion";
import { Link } from "next-view-transitions";

import dayjs from "@chia/utils/day";

import { cn } from "../../utils/cn.util";
import useInfiniteScroll from "../../utils/use-infinite-scroll";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../accordion";
import { useTimeline } from "./context";
import type { ListItemProps, ListProps, GroupListProps } from "./types";

export const Year: FC<{
  year: string | number | dayjs.Dayjs;
  className?: string;
}> = ({ year, className }) => {
  const { groupTemplate } = useTimeline();
  return (
    <span
      className={cn("text-[5em] font-bold leading-3 opacity-20", className)}>
      {dayjs(year).format(groupTemplate)}
    </span>
  );
};

export const Item: FC<ListItemProps> = ({
  data,
  className,
  refTarget,
  isLastItem,
  ...props
}) => {
  const { defaultOpen = true, titleProps, subtitleProps, linkProps } = data;
  return (
    <motion.div
      ref={isLastItem ? refTarget : undefined}
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
      className={cn("z-10 flex flex-col text-start", className)}
      {...props}>
      <>
        <span
          {...titleProps}
          className={cn("text-lg font-bold", titleProps?.className)}>
          {data.link ? (
            <Link
              href={data.link}
              {...linkProps}
              style={{
                viewTransitionName: `view-transition-link-${data.id}`,
                ...linkProps?.style,
              }}
              className={cn(linkProps?.className)}>
              {data.title}
            </Link>
          ) : (
            data.title
          )}
        </span>{" "}
        <span
          {...subtitleProps}
          className={cn("text-sm text-gray-500", subtitleProps?.className)}>
          {data.subtitle}
        </span>
      </>
      {data.content && (
        <Accordion
          type="single"
          collapsible
          className="w-full"
          defaultValue={defaultOpen ? data.id.toString() : undefined}>
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
    </motion.div>
  );
};

export const List: FC<ListProps> = ({
  year,
  data,
  className,
  isLastGroup,
  refTarget,
  ...props
}) => (
  <motion.ul {...props}>
    <li className={cn("relative flex flex-col gap-1", className)}>
      <Year year={year} className="absolute -top-4 left-0" />
      {data.map((item, index) => (
        <Item
          refTarget={
            isLastGroup && data.length - 1 === index ? refTarget : undefined
          }
          key={item.id}
          data={item}
          isLastItem={isLastGroup && data.length - 1 === index}
        />
      ))}
    </li>
  </motion.ul>
);

export const LoadingSkeletons = () => (
  <div className="relative flex animate-pulse flex-col gap-5 p-5">
    <span className="c-bg-secondary absolute -top-10 left-0 h-14 w-1/4 rounded" />
    <div className="flex flex-col gap-2">
      <div className="c-bg-secondary h-4 w-full rounded-full" />
      <div className="c-bg-secondary h-4 w-2/3 rounded-full" />
    </div>
    <div className="flex flex-col gap-2">
      <div className="c-bg-secondary h-4 w-full rounded-full" />
      <div className="c-bg-secondary h-4 w-2/3 rounded-full" />
    </div>
    <div className="flex flex-col gap-2">
      <div className="c-bg-secondary h-4 w-full rounded-full" />
      <div className="c-bg-secondary h-4 w-2/3 rounded-full" />
    </div>
  </div>
);

export const GroupList: FC<GroupListProps> = ({
  data,
  onEndReached,
  asyncDataStatus,
}) => {
  const { ref } = useInfiniteScroll<HTMLDivElement>({
    onLoadMore: onEndReached,
    isLoading: asyncDataStatus?.isLoading,
    isError: asyncDataStatus?.isError,
    hasMore: asyncDataStatus?.hasMore,
  });
  return (
    <>
      {data.map((item, index) => (
        <List
          refTarget={data.length - 1 === index ? ref : undefined}
          isLastGroup={data.length - 1 === index}
          key={item.year.toString()}
          year={item.year.toString()}
          data={item.data}
        />
      ))}
      {
        // Show loading skeletons when loading more data
        asyncDataStatus?.isLoading && (
          <span className="flex justify-center w-full">
            <CircularProgress color="secondary" />
          </span>
        )
      }
    </>
  );
};
