import type {
  ReactNode,
  ComponentPropsWithoutRef,
  ComponentProps,
} from "react";

import type { Dayjs } from "dayjs";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";

import type { LinkProps } from "../link";

export interface Data {
  id: number;
  title: ReactNode;
  subtitle?: ReactNode;
  content?: ReactNode;
  startDate: Dayjs | string | number | Date | null;
  link?: string;
  defaultOpen?: boolean;
  titleProps?: ComponentPropsWithoutRef<"span">;
  subtitleProps?: ComponentPropsWithoutRef<"span">;
  linkProps?: Partial<LinkProps>;
  slug?: string;
}

export interface GroupData {
  year: Dayjs | string | number;
  data: Data[];
}

export interface AsyncDataStatus {
  isLoading?: boolean;
  isError?: boolean;
  hasMore?: boolean;
}

export interface TimelineProps extends ComponentPropsWithoutRef<"div"> {
  data: Data[];
  enableSort?: boolean;
  onEndReached?: () => void;
  asyncDataStatus?: AsyncDataStatus;
  groupTemplate?: string;
  /**
   * @todo
   */
  tz?: string;
}

export interface ListItemProps
  extends ComponentProps<
    ForwardRefComponent<HTMLDivElement, HTMLMotionProps<"div">>
  > {
  data: Data;
  isLastItem: boolean;
  refTarget?: (node: HTMLDivElement) => void;
}

export type ListProps = ComponentPropsWithoutRef<
  ForwardRefComponent<"ul", HTMLMotionProps<"ul">>
> &
  GroupData & {
    isLastGroup: boolean;
    refTarget?: (node: HTMLDivElement) => void;
  };

export interface GroupListProps {
  data: GroupData[];
  onEndReached?: () => void;
  asyncDataStatus?: AsyncDataStatus;
}
