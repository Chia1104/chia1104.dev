import type { LinkProps } from "next/link";
import type {
  ReactNode,
  ComponentPropsWithoutRef,
  ComponentProps,
} from "react";

import type { Dayjs } from "dayjs";
import type { HTMLMotionProps, ForwardRefComponent } from "motion/react";

export interface TimelineItemData {
  id: number;
  title: ReactNode;
  subtitle?: ReactNode;
  content?: ReactNode;
  startDate: Dayjs | string | number | Date | null;
  link?: string;
  defaultOpen?: boolean;
  titleProps?: ComponentPropsWithoutRef<"span">;
  subtitleProps?: ComponentPropsWithoutRef<"span">;
  linkProps?: Partial<LinkProps & ComponentPropsWithoutRef<"a">>;
  slug?: string;
}

export interface TimelineGroupData {
  year: Dayjs | string | number;
  data: TimelineItemData[];
}

export interface AsyncDataStatus {
  isLoading?: boolean;
  isError?: boolean;
  hasMore?: boolean;
}

export interface TimelineContextValue {
  groupTemplate: string;
  tz?: string;
}

export interface TimelineProps extends ComponentPropsWithoutRef<"div"> {
  data: TimelineItemData[];
  enableSort?: boolean;
  onEndReached?: () => void;
  asyncDataStatus?: AsyncDataStatus;
  groupTemplate?: string;
  tz?: string;
}

export interface TimelineItemProps extends ComponentProps<
  ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>
> {
  data: TimelineItemData;
  isLastItem: boolean;
  refTarget?: (node: HTMLDivElement) => void;
}

export type TimelineListProps = ComponentPropsWithoutRef<
  ForwardRefComponent<"ul", HTMLMotionProps<"ul">>
> &
  TimelineGroupData & {
    isLastGroup: boolean;
    refTarget?: (node: HTMLDivElement) => void;
  };

export interface TimelineGroupListProps {
  data: TimelineGroupData[];
  onEndReached?: () => void;
  asyncDataStatus?: AsyncDataStatus;
}
