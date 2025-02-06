"use client";

import React from "react";

import type { RadioGroupProps, RadioProps } from "@heroui/react";
import {
  RadioGroup,
  VisuallyHidden,
  useRadio,
  useRadioGroupContext,
} from "@heroui/react";
import { cn } from "@heroui/react";
import { Icon } from "@iconify/react";

import { Theme } from "@chia/ui/theme";
import useTheme from "@chia/ui/utils/use-theme";

const ThemeRadioItem = ({ icon, ...props }: RadioProps & { icon: string }) => {
  const {
    Component,
    isSelected: isSelfSelected,
    getBaseProps,
    getInputProps,
    getWrapperProps,
  } = useRadio(props);

  const groupContext = useRadioGroupContext();

  const isSelected =
    isSelfSelected ||
    Number(groupContext.groupState.selectedValue) >= Number(props.value);

  const wrapperProps = getWrapperProps();

  return (
    <Component {...getBaseProps()}>
      <VisuallyHidden>
        <input {...getInputProps()} />
      </VisuallyHidden>
      <div
        {...wrapperProps}
        className={cn(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          wrapperProps?.className,
          "pointer-events-none h-8 w-8 rounded-full border-black border-opacity-10 ring-0 transition-transform group-data-[pressed=true]:scale-90",
          {
            "bg-default-200 dark:bg-default-100": isSelected,
          }
        )}>
        <Icon className="text-default-500" icon={icon} width={18} />
      </div>
    </Component>
  );
};

const ThemeSwitch = React.forwardRef<
  HTMLDivElement,
  Omit<RadioGroupProps, "children">
>(({ classNames = {}, ...props }, ref) => {
  const { theme = Theme.SYSTEM, setTheme } = useTheme();
  return (
    <RadioGroup
      ref={ref}
      aria-label="Select a theme"
      classNames={{
        ...classNames,
        wrapper: cn("gap-0 items-center", classNames?.wrapper),
      }}
      onValueChange={(value) => {
        setTheme(value as Theme);
      }}
      defaultValue={theme}
      orientation="horizontal"
      {...props}>
      <ThemeRadioItem icon="solar:moon-linear" value={Theme.DARK} />
      <ThemeRadioItem icon="solar:sun-2-linear" value={Theme.LIGHT} />
      <ThemeRadioItem icon="solar:monitor-linear" value={Theme.SYSTEM} />
    </RadioGroup>
  );
});

ThemeSwitch.displayName = "ThemeSwitch";

export default ThemeSwitch;
