"use client";

import { memo } from "react";
import type { FC } from "react";
import { ViewTransition } from "react";

import { CircularProgress } from "@heroui/react";
import { motion } from "framer-motion";
import Link from "next/link";

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
import type {
  TimelineItemProps,
  TimelineListProps,
  TimelineGroupListProps,
} from "./types";

// Constants
const ANIMATION_CONFIG = {
  whileInView: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
  initial: {
    opacity: 0,
    y: 20,
  },
} as const;

const YEAR_CLASSNAME = "text-[5em] font-bold leading-3 opacity-20";
const TITLE_CLASSNAME = "text-lg font-bold";
const SUBTITLE_CLASSNAME = "text-sm text-gray-500";
const MORE_TEXT = "MORE";

// Year Component
interface TimelineYearProps {
  year: string | number | dayjs.Dayjs;
  className?: string;
}

export const TimelineYear: FC<TimelineYearProps> = memo(
  ({ year, className }) => {
    const { groupTemplate } = useTimeline();

    return (
      <span className={cn(YEAR_CLASSNAME, className)}>
        {dayjs(year).format(groupTemplate)}
      </span>
    );
  }
);

// Item Link Component
interface TimelineItemLinkProps {
  id: number;
  href: string;
  title: React.ReactNode;
  linkProps?: TimelineItemProps["data"]["linkProps"];
}

const TimelineItemLink: FC<TimelineItemLinkProps> = memo(
  ({ id, href, title, linkProps }) => {
    const transitionName = `view-transition-link-${id}`;

    return (
      <ViewTransition name={transitionName}>
        <Link
          href={href}
          prefetch={false}
          {...linkProps}
          style={{
            viewTransitionName: transitionName,
            ...linkProps?.style,
          }}
          className={cn("inline-block", linkProps?.className)}>
          {title}
        </Link>
      </ViewTransition>
    );
  }
);

// Item Content Component
interface TimelineItemContentProps {
  id: number;
  content: React.ReactNode;
  defaultOpen: boolean;
}

const TimelineItemContent: FC<TimelineItemContentProps> = memo(
  ({ id, content, defaultOpen }) => {
    const itemValue = id.toString();

    return (
      <Accordion
        type="single"
        collapsible
        className="w-full"
        defaultValue={defaultOpen ? itemValue : undefined}>
        <AccordionItem
          value={itemValue}
          className="prose-h3:m-1 prose-h3:w-fit">
          <AccordionTrigger className="flex w-fit p-0 text-sm text-gray-500 dark:text-gray-300">
            {MORE_TEXT}
          </AccordionTrigger>
          <AccordionContent>{content}</AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }
);

// Timeline Item Component
export const TimelineItem: FC<TimelineItemProps> = memo(
  ({ data, className, refTarget, isLastItem, ...props }) => {
    const {
      id,
      title,
      subtitle,
      content,
      link,
      defaultOpen = true,
      titleProps,
      subtitleProps,
      linkProps,
    } = data;

    return (
      <motion.div
        ref={isLastItem ? refTarget : undefined}
        whileInView={ANIMATION_CONFIG.whileInView}
        initial={ANIMATION_CONFIG.initial}
        className={cn("z-10 flex flex-col text-start", className)}
        {...props}>
        <span
          {...titleProps}
          className={cn(TITLE_CLASSNAME, titleProps?.className)}>
          {link ? (
            <TimelineItemLink
              id={id}
              href={link}
              title={title}
              linkProps={linkProps}
            />
          ) : (
            title
          )}
        </span>

        {subtitle && (
          <span
            {...subtitleProps}
            className={cn(SUBTITLE_CLASSNAME, subtitleProps?.className)}>
            {subtitle}
          </span>
        )}

        {content && (
          <TimelineItemContent
            id={id}
            content={content}
            defaultOpen={defaultOpen}
          />
        )}
      </motion.div>
    );
  }
);

// Timeline List Component
export const TimelineList: FC<TimelineListProps> = memo(
  ({ year, data, className, isLastGroup, refTarget, ...props }) => {
    const lastIndex = data.length - 1;

    return (
      <motion.ul {...props}>
        <li className={cn("relative flex flex-col gap-1", className)}>
          <TimelineYear year={year} className="absolute -top-4 left-0" />
          {data.map((item, index) => {
            const isLastItemInGroup = isLastGroup && index === lastIndex;

            return (
              <TimelineItem
                key={item.id}
                data={item}
                isLastItem={isLastItemInGroup}
                refTarget={isLastItemInGroup ? refTarget : undefined}
              />
            );
          })}
        </li>
      </motion.ul>
    );
  }
);

// Loading Skeletons Component
export const TimelineLoadingSkeletons: FC = memo(() => (
  <div className="relative flex animate-pulse flex-col gap-5 p-5">
    <span className="c-bg-secondary absolute -top-10 left-0 h-14 w-1/4 rounded" />
    {[1, 2, 3].map((i) => (
      <div key={i} className="flex flex-col gap-2">
        <div className="c-bg-secondary h-4 w-full rounded-full" />
        <div className="c-bg-secondary h-4 w-2/3 rounded-full" />
      </div>
    ))}
  </div>
));

// Group List Component
export const TimelineGroupList: FC<TimelineGroupListProps> = memo(
  ({ data, onEndReached, asyncDataStatus }) => {
    const { ref } = useInfiniteScroll<HTMLDivElement>({
      onLoadMore: onEndReached,
      isLoading: asyncDataStatus?.isLoading,
      isError: asyncDataStatus?.isError,
      hasMore: asyncDataStatus?.hasMore,
    });

    const lastIndex = data.length - 1;
    const isLoading = asyncDataStatus?.isLoading;

    return (
      <>
        {data.map((item, index) => {
          const isLastGroup = index === lastIndex;

          return (
            <TimelineList
              key={item.year.toString()}
              year={item.year.toString()}
              data={item.data}
              isLastGroup={isLastGroup}
              refTarget={isLastGroup ? ref : undefined}
            />
          );
        })}

        {isLoading && (
          <div className="flex w-full justify-center">
            <CircularProgress
              color="secondary"
              aria-label="Loading more items"
            />
          </div>
        )}
      </>
    );
  }
);
