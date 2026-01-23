"use client";

import { Button, Tooltip } from "@heroui/react";
import type { ButtonProps, PressEvent, ImageProps } from "@heroui/react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, CopyCheck } from "lucide-react";

import { cn } from "../utils/cn.util";
import { useClipboard } from "../utils/use-copy-to-clipboard";

interface Props extends Omit<ButtonProps, "onPress" | "onCopy"> {
  content: string;
  timeout?: number;
  onCopy?: (e: PressEvent) => void;
  iconProps?: React.ComponentPropsWithoutRef<"span"> | ImageProps;
  translations?: {
    copied: string;
    copy: string;
  };
}

export const CopyButton = ({
  content,
  onCopy,
  timeout,
  iconProps,
  translations,
  ...props
}: Props) => {
  const { copy, copied } = useClipboard({ timeout });
  return (
    <Tooltip
      content={copied ? translations?.copied : translations?.copy}
      size="sm">
      <Button
        aria-label="copy"
        isIconOnly
        size="sm"
        {...props}
        className={cn("text-default-600", props.className)}
        onPress={(e) => {
          copy(content);
          onCopy?.(e);
        }}>
        <AnimatePresence>
          {copied ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}>
              <CopyCheck
                className={cn("size-3", iconProps?.className)}
                strokeWidth={1}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}>
              <Copy
                className={cn("size-3", iconProps?.className)}
                strokeWidth={1}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Button>
    </Tooltip>
  );
};
