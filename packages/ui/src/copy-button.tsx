"use client";

import type { ButtonProps, PressEvent } from "@heroui/react";
import { Button, Tooltip } from "@heroui/react";
import { Copy, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "../utils/cn.util";
import { useClipboard } from "../utils/use-copy-to-clipboard";

interface Props extends Omit<ButtonProps, "onPress" | "onCopy"> {
  content: string;
  timeout?: number;
  onCopy?: (e: PressEvent) => void;
  iconProps?: React.ComponentPropsWithoutRef<"span">;
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
    <Tooltip>
      <Tooltip.Trigger className="flex items-center justify-center">
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
                <CheckCheck
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
      </Tooltip.Trigger>
      <Tooltip.Content>
        {copied ? translations?.copied : translations?.copy}
      </Tooltip.Content>
    </Tooltip>
  );
};
