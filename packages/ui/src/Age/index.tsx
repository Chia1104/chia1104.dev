"use client";

import { useEffect, useRef } from "react";
import type { FC, ComponentPropsWithoutRef } from "react";

import dayjs from "dayjs";
import { useInView, useMotionValue, useSpring } from "framer-motion";

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
  const isInView = useInView(ref, { once: true, margin: "0px" });
  useEffect(() => {
    if (isInView)
      setTimeout(() => {
        motionValue.set(direction === "down" ? 0 : value);
      }, delay * 1000);
  }, [motionValue, isInView, delay, value, direction]);

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
