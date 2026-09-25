"use client";

import Link from "next/link";
import type { FC } from "react";
import { memo } from "react";
import { ViewTransition } from "react";

import { Disclosure, Spinner } from "@heroui/react";

import dayjs from "@chia/utils/day";

import { cn } from "../../utils/cn.util";
import useInfiniteScroll from "../../utils/use-infinite-scroll";

import { useTimeline } from "./context";
import type {
  TimelineItemProps,
  TimelineListProps,
  TimelineGroupListProps,
} from "./types";

const MORE_TEXT = "More";

interface TimelineYearProps {
  year: string | number | dayjs.Dayjs;
  className?: string;
}

export const TimelineYear: FC<TimelineYearProps> = memo(
  ({ year, className }) => {
    const { groupTemplate } = useTimeline();

    return (
      <span
        className={cn(
          "text-muted/60 block text-4xl leading-none font-semibold tracking-tight tabular-nums",
          className
        )}>
        {dayjs(year).format(groupTemplate)}
      </span>
    );
  }
);

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
          className={cn("link inline-block", linkProps?.className)}>
          {title}
        </Link>
      </ViewTransition>
    );
  }
);

interface TimelineItemContentProps {
  content: React.ReactNode;
  defaultOpen: boolean;
}

const TimelineItemContent: FC<TimelineItemContentProps> = memo(
  ({ content, defaultOpen }) => (
    <Disclosure defaultExpanded={defaultOpen} className="w-full">
      <Disclosure.Heading className="flex">
        <Disclosure.Trigger className="text-muted hover:text-foreground flex w-fit items-center gap-1 p-0 text-xs font-medium">
          {MORE_TEXT}
          <Disclosure.Indicator className="size-3" />
        </Disclosure.Trigger>
      </Disclosure.Heading>
      <Disclosure.Content className="text-sm leading-relaxed">
        <div className="pt-2">{content}</div>
      </Disclosure.Content>
    </Disclosure>
  )
);

export const TimelineItem: FC<TimelineItemProps> = memo(
  ({ data, className, refTarget, isLastItem, ...props }) => {
    const {
      id,
      title,
      subtitle,
      description,
      content,
      link,
      defaultOpen = true,
      titleProps,
      subtitleProps,
      linkProps,
    } = data;

    return (
      <div
        ref={isLastItem ? refTarget : undefined}
        className={cn("flex flex-col gap-1 px-4 py-3 text-start", className)}
        {...props}>
        <span
          {...titleProps}
          className={cn(
            "text-base leading-snug font-semibold",
            titleProps?.className
          )}>
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
            className={cn("text-muted text-sm", subtitleProps?.className)}>
            {subtitle}
          </span>
        )}

        {description && (
          <p className="text-sm leading-relaxed text-pretty">{description}</p>
        )}

        {content && (
          <TimelineItemContent content={content} defaultOpen={defaultOpen} />
        )}
      </div>
    );
  }
);

/**
 * One year of the ledger: the year holds a gutter column and stays pinned while its rows scroll,
 * rows are split by hairlines. In a narrow container the year becomes the group's header row.
 */
export const TimelineList: FC<TimelineListProps> = memo(
  ({ year, data, className, isLastGroup, refTarget, ...props }) => {
    const lastIndex = data.length - 1;

    return (
      <section
        className={cn(
          "border-separator border-b last:border-b-0 @lg:grid @lg:grid-cols-[8rem_minmax(0,1fr)]",
          className
        )}
        {...props}>
        <div className="border-separator border-b px-4 py-3 @lg:border-r @lg:border-b-0">
          <TimelineYear
            year={year}
            className="text-3xl @lg:sticky @lg:top-[calc(var(--header-height,0px)+0.75rem)] @lg:text-4xl"
          />
        </div>
        <ul className="divide-separator divide-y">
          {data.map((item, index) => {
            const isLastItemInGroup = isLastGroup && index === lastIndex;

            return (
              <li key={item.id}>
                <TimelineItem
                  data={item}
                  isLastItem={isLastItemInGroup}
                  refTarget={isLastItemInGroup ? refTarget : undefined}
                />
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
);

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
          <div className="flex w-full justify-center py-4">
            <Spinner aria-label="Loading more items" />
          </div>
        )}
      </>
    );
  }
);
