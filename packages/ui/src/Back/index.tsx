"use client";

import type { FC, ReactNode, SVGProps } from "react";
import { useRouter } from "next/navigation";
import { cn } from "../utils";
import type { HTMLMotionProps } from "framer-motion";
import { motion } from "framer-motion";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  icon?: ReactNode;
  iconProps?: IconProps;
  dirName?: string;
  children?: ReactNode;
}

type IconProps = SVGProps<SVGSVGElement>;

const BackIcon: FC<IconProps> = ({ className, ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    {...props}
    className={cn("h-6 w-6", className)}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.75 19.5L8.25 12l7.5-7.5"
    />
  </svg>
);

const Back: FC<Props> = ({
  children,
  className,
  icon,
  iconProps,
  dirName,
  ...props
}) => {
  const router = useRouter();
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      {...props}
      className={cn("group rounded-lg p-1 shadow-sm", className)}
      onClick={() => (dirName ? router.push(`/${dirName}`) : router.back())}>
      <span className="flex items-center justify-center gap-1">
        {icon ?? (
          <BackIcon
            {...iconProps}
            className={cn(
              "inline-block transition-transform group-hover:-translate-x-[3px] motion-reduce:transform-none",
              iconProps?.className
            )}
          />
        )}
        {children ?? `cd ../${dirName ?? ""}`}
      </span>
    </motion.button>
  );
};

export default Back;
