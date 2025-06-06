"use client";

import { useState, useEffect } from "react";
import type { KeyboardEvent, Dispatch, DependencyList } from "react";

import type { DialogProps } from "@radix-ui/react-dialog";
import type { ClassValue } from "clsx";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "../utils/cn.util";
import { Dialog, DialogContent } from "./dialog";

export const useCMD = (
  defaultOpen = false,
  options?: {
    cmd?: string;
    onKeyDown?: (e: KeyboardEvent) => void;
  },
  deps?: DependencyList
): [boolean, Dispatch<boolean>] => {
  const cmd = options?.cmd ?? "k";
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === cmd && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
        options?.onKeyDown?.(e);
      }
    };

    // @ts-expect-error - are we cool?
    document.addEventListener("keydown", down);
    // @ts-expect-error - are we cool?
    return () => document.removeEventListener("keydown", down);
  }, deps ?? []);
  return [open, setOpen];
};

const Command = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive>) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "bg-popover dark:bg-dark/10 text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md backdrop-blur-lg",
      className
    )}
    {...props}
  />
);

type CommandDialogProps = DialogProps;

const CommandDialog = ({
  children,
  commandProps,
  ...props
}: CommandDialogProps & {
  commandProps?: React.ComponentPropsWithRef<typeof Command>;
}) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden border-[#FCA5A5]/50 p-0 shadow-[0px_0px_15px_4px_rgb(252_165_165_/_0.3)] transition-all dark:border-purple-400/50 dark:shadow-[0px_0px_15px_4px_RGB(192_132_252_/_0.3)]">
        <Command
          className={cn(
            "[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5",
            commandProps?.className
          )}
          {...commandProps}>
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const _CommandDialog = ({ children, ...props }: DialogProps) => {
  return (
    <Dialog {...props}>
      <DialogContent className="overflow-hidden p-0">
        <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  );
};

const CommandLoading = CommandPrimitive.Loading;

const CommandInput = ({
  className,
  ref,
  classNames,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Input> & {
  classNames?: {
    input?: ClassValue;
    wrapper?: ClassValue;
  };
}) => (
  <div
    className={cn(
      "border-default flex items-center border-b px-3",
      classNames?.wrapper
    )}
    cmdk-input-wrapper="">
    <Search className="mr-2 size-4 shrink-0 opacity-50" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        "placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
        classNames?.input
      )}
      {...props}
    />
  </div>
);

const CommandList = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("max-h-[300px] overflow-y-auto overflow-x-hidden", className)}
    {...props}
  />
);

const CommandEmpty = (
  props: React.ComponentPropsWithRef<typeof CommandPrimitive.Empty>
) => <CommandPrimitive.Empty className="py-6 text-center text-sm" {...props} />;

const CommandGroup = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "text-foreground [&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium",
      className
    )}
    {...props}
  />
);

const CommandSeparator = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn("bg-default -mx-1 h-px", className)}
    {...props}
  />
);

const CommandItem = ({
  className,
  ref,
  ...props
}: React.ComponentPropsWithRef<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "aria-selected:bg-default aria-selected:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:cursor-pointer data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className
    )}
    {...props}
  />
);

const CommandShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        "text-muted-foreground ml-auto text-xs tracking-widest",
        className
      )}
      {...props}
    />
  );
};
CommandShortcut.displayName = "CommandShortcut";

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
  CommandLoading,
};
