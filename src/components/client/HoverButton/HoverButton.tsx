"use client";

import type {
  FC,
  ReactNode,
  RefObject,
  DetailedHTMLProps,
  ButtonHTMLAttributes,
} from "react";
import { motion } from "framer-motion";
import { useHover } from "usehooks-ts";

interface Props
  extends DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
  > {
  onClick?: () => void;
  children?: ReactNode;
  refTarget: RefObject<HTMLElement>;
}

const HoverButton: FC<Props> = (props) => {
  const { onClick, children, refTarget, ...rest } = props;
  const v = {
    open: { opacity: 1, y: 0 },
    closed: { opacity: 0, y: -20 },
  };

  const isHover = useHover(refTarget);

  return (
    <motion.div
      initial={"closed"}
      animate={isHover ? "open" : "closed"}
      variants={v}
      className="absolute top-0 left-0 flex h-full w-full items-center justify-center bg-gradient-to-b from-gray-600/70 to-gray-600/0">
      <button onClick={onClick} {...rest}>
        {children || (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-14 w-14 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
            />
          </svg>
        )}
      </button>
    </motion.div>
  );
};

export default HoverButton;
