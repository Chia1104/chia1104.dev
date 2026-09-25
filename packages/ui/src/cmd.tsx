"use client";

import type { ReactNode } from "react";

import { Modal, SearchField } from "@heroui/react";
import { Autocomplete } from "react-aria-components/Autocomplete";

import { cn } from "../utils/cn.util";

/**
 * Command palette: a modal whose search field drives the one HeroUI `ListBox` rendered in `children`.
 * Filtering is the caller's; the list shows whatever it is given.
 */
const CommandDialog = ({
  isOpen,
  onOpenChange,
  inputValue,
  onInputChange,
  "aria-label": ariaLabel,
  className,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  inputValue?: string;
  onInputChange?: (value: string) => void;
  "aria-label": string;
  className?: string;
  children: ReactNode;
}) => (
  <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
    <Modal.Container placement="center">
      <Modal.Dialog
        aria-label={ariaLabel}
        className={cn(
          "bg-surface/(--popover-opacity) text-overlay-foreground overflow-hidden p-0 backdrop-blur-sm sm:max-w-lg",
          className
        )}>
        <Autocomplete inputValue={inputValue} onInputChange={onInputChange}>
          {children}
        </Autocomplete>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
);

const CommandInput = ({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) => (
  <SearchField
    aria-label={placeholder}
    autoFocus
    fullWidth
    className={cn("border-default border-b p-2", className)}>
    <SearchField.Group className="border-0 bg-transparent shadow-none focus-within:ring-0 hover:bg-transparent data-[focus-within=true]:ring-0 data-[hovered=true]:bg-transparent">
      <SearchField.SearchIcon />
      <SearchField.Input placeholder={placeholder} />
      <SearchField.ClearButton />
    </SearchField.Group>
  </SearchField>
);

export { CommandDialog, CommandInput };
