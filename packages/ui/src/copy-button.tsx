"use client";

import type { ButtonProps, PressEvent } from "@heroui/react";
import { Button, Spinner, Tooltip } from "@heroui/react";
import { Copy, CheckCheck } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "../utils/cn.util";
import { useClipboard } from "../utils/use-copy-to-clipboard";

interface BaseProps extends Omit<ButtonProps, "onPress" | "onCopy"> {
  timeout?: number;
  onCopy?: (e: PressEvent) => void;
  iconProps?: React.ComponentPropsWithoutRef<"span">;
  translations?: {
    copied: string;
    copy: string;
  };
}

type Props = BaseProps &
  (
    | { content: string; loadContent?: never }
    | {
        content?: never;
        /** Runs on press, for text too large to ship with the page. */
        loadContent: () => Promise<string>;
      }
  );

export const CopyButton = ({
  content,
  loadContent,
  onCopy,
  timeout,
  iconProps,
  translations,
  isPending,
  ...props
}: Props) => {
  const { copy, copyPending, copied } = useClipboard({ timeout });
  return (
    <Tooltip>
      <Tooltip.Trigger className="flex items-center justify-center">
        <Button
          aria-label="copy"
          isIconOnly
          size="sm"
          isPending={isPending}
          {...props}
          className={cn("text-muted", props.className)}
          onPress={(e) => {
            if (loadContent) {
              copyPending(loadContent());
            } else {
              copy(content);
            }
            onCopy?.(e);
          }}>
          <AnimatePresence>
            {isPending ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.2 }}>
                <Spinner
                  size="sm"
                  color="current"
                  className={cn("size-3", iconProps?.className)}
                />
              </motion.div>
            ) : copied ? (
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
