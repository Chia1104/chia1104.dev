import type {
  ReactNode,
  ComponentPropsWithoutRef,
  ComponentProps,
} from "react";

import type { Dayjs } from "dayjs";
import type { HTMLMotionProps, ForwardRefComponent } from "framer-motion";

import type { LinkProps } from "../Link";

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
}

export interface GroupData {
  year: Dayjs | string | number;
  data: Data[];
}

/**
 * @deprecated
 * ```ts
 * const timelineData = {
 *  "2023": [
 *      {
 *          title: "Bachelor of Science in Computer Science",
 *          subtitle: "National Taiwan University",
 *          startDate: new Date("2023-09-01"),
 *          content: "I will be studying computer science at NTU.",
 *      }
 *  ],
 *  "2022": [
 *      {
 *          title: "Bachelor of Science in Computer Science",
 *          subtitle: "National Taiwan University",
 *          startDate: new Date("2023-09-01"),
 *          content: "I will be studying computer science at NTU.",
 *      }
 *  ]
 * }
 * ```
 */
export type TimelineData = Record<string, Data[]>;

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
  experimental?: {
    enableViewTransition?: boolean;
  };
}

export interface ListItemProps
  extends ComponentProps<
    ForwardRefComponent<HTMLLIElement, HTMLMotionProps<"li">>
  > {
  data: Data;
  isLastItem: boolean;
  refTarget?: (node: HTMLLIElement) => void;
  experimental?: {
    enableViewTransition?: boolean;
  };
}

export type ListProps = ComponentPropsWithoutRef<
  ForwardRefComponent<"ul", HTMLMotionProps<"ul">>
> &
  GroupData & {
    isLastGroup: boolean;
    refTarget?: (node: HTMLLIElement) => void;
    experimental?: {
      enableViewTransition?: boolean;
    };
  };

export interface GroupListProps {
  data: GroupData[];
  onEndReached?: () => void;
  asyncDataStatus?: AsyncDataStatus;
  experimental?: {
    enableViewTransition?: boolean;
  };
}
