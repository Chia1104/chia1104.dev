import {
  type ReactNode,
  type ComponentPropsWithoutRef,
  type ComponentProps,
} from "react";
import { type HTMLMotionProps, type ForwardRefComponent } from "framer-motion";

export interface Data {
  id: number;
  title: ReactNode;
  subtitle?: ReactNode;
  content?: ReactNode;
  startDate: dayjs.Dayjs | string | number | null;
}

/**
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
export interface TimelineData {
  [year: string]: Data[];
}

export interface TimelineProps extends ComponentPropsWithoutRef<"div"> {
  data: Data[];
}

export interface ListItemProps
  extends ComponentProps<
    ForwardRefComponent<HTMLLIElement, HTMLMotionProps<"li">>
  > {
  data: Data;
}

export interface ListProps
  extends ComponentPropsWithoutRef<
    ForwardRefComponent<"ul", HTMLMotionProps<"ul">>
  > {
  year: string | number;
  data: Data[];
}
