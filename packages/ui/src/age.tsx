"use client";

import type { FC, ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

import { useDebouncedCallback } from "@tanstack/react-pacer";
import { useInView, useMotionValue, useSpring } from "motion/react";

import dayjs from "@chia/utils/day";

interface Props extends ComponentPropsWithoutRef<"span"> {
  birthday: dayjs.Dayjs | string | number;
  direction?: "up" | "down";
  delay?: number;
}

const Age: FC<Props> = ({
  birthday,
  direction = "up",
  delay = 0,
  ...props
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const value = dayjs().diff(birthday, "year");
  const motionValue = useMotionValue(direction === "down" ? value : 0);
  const springValue = useSpring(motionValue, {
    damping: 60,
    stiffness: 100,
  });
  const isInView = useInView(ref, {
    once: true,
    margin: "0px",
  });
  const start = useDebouncedCallback(
    () => motionValue.set(direction === "down" ? 0 : value),
    { wait: delay * 1000 }
  );
  useEffect(() => {
    if (isInView) start();
  }, [isInView, start]);

  useEffect(() => {
    springValue.on("change", (latest: number) => {
      if (ref.current) {
        ref.current.textContent = Intl.NumberFormat("en-US").format(
          Number(latest.toFixed(0))
        );
      }
    });
    return () => {
      springValue.destroy();
    };
  }, [springValue]);
  return (
    <span {...props} ref={ref}>
      {value}
    </span>
  );
};

export default Age;
