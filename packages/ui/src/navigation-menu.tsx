"use client";

import type { ComponentProps, ReactNode, RefObject } from "react";
import {
  createContext,
  use,
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
} from "react";

import { Button, Popover } from "@heroui/react";
import { ChevronDown } from "lucide-react";

import { cn } from "../utils/cn.util";

const OPEN_DELAY = 200;
const CLOSE_DELAY = 150;
/** Reopening within this window after a close skips the open delay. */
const SKIP_DELAY = 300;

type Motion = "from-start" | "from-end";

interface NavigationMenuContextValue {
  anchorRef: RefObject<HTMLElement | null>;
  value: string | null;
  isOpen: boolean;
  motion: Motion | null;
  registerTrigger: (value: string, element: HTMLElement | null) => void;
  show: (value: string, options?: { focusContent?: boolean }) => void;
  hide: () => void;
  scheduleShow: (value: string) => void;
  scheduleHide: () => void;
  cancelSchedule: () => void;
  takeFocusRequest: () => boolean;
  restoreFocus: (value: string) => void;
}

const NavigationMenuContext = createContext<NavigationMenuContextValue | null>(
  null
);

const useNavigationMenu = () => {
  const context = use(NavigationMenuContext);
  if (!context) {
    throw new Error(
      "NavigationMenu parts must be rendered inside NavigationMenu."
    );
  }
  return context;
};

const NavigationMenuItemContext = createContext<string | null>(null);

const useNavigationMenuItem = () => {
  const value = use(NavigationMenuItemContext);
  if (value === null) {
    throw new Error(
      "NavigationMenu trigger and content must be rendered inside NavigationMenuItem."
    );
  }
  return value;
};

/**
 * Hover menu of HeroUI popovers that all anchor to the menu, so every item opens in the same place.
 * Switching items skips the popovers' own enter and exit animations and slides the new content in
 * from the side it came from instead.
 */
const NavigationMenu = ({
  className,
  children,
  ...props
}: ComponentProps<"nav">) => {
  const anchorRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLElement>());
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const closedAt = useRef(0);
  const focusRequest = useRef(false);
  const [state, setState] = useState<{
    value: string | null;
    isOpen: boolean;
    motion: Motion | null;
  }>({ value: null, isOpen: false, motion: null });

  const clearTimer = () => clearTimeout(timer.current);
  useEffect(() => clearTimer, []);

  const show = (value: string, options?: { focusContent?: boolean }) => {
    clearTimer();
    focusRequest.current = options?.focusContent ?? false;
    setState((previous) => {
      if (previous.isOpen && previous.value === value) return previous;
      const from = previous.isOpen && previous.value;
      const fromElement = from ? triggers.current.get(from) : undefined;
      const toElement = triggers.current.get(value);
      const motion =
        fromElement && toElement
          ? fromElement.compareDocumentPosition(toElement) &
            Node.DOCUMENT_POSITION_FOLLOWING
            ? "from-end"
            : "from-start"
          : null;
      return { value, isOpen: true, motion };
    });
  };

  const hide = () => {
    clearTimer();
    closedAt.current = Date.now();
    setState((previous) =>
      previous.isOpen ? { ...previous, isOpen: false } : previous
    );
  };

  const context: NavigationMenuContextValue = {
    ...state,
    anchorRef,
    registerTrigger: (value, element) => {
      if (element) triggers.current.set(value, element);
      else triggers.current.delete(value);
    },
    show,
    hide,
    scheduleShow: (value) => {
      clearTimer();
      if (state.isOpen || Date.now() - closedAt.current < SKIP_DELAY) {
        show(value);
        return;
      }
      timer.current = setTimeout(() => show(value), OPEN_DELAY);
    },
    scheduleHide: () => {
      clearTimer();
      timer.current = setTimeout(hide, CLOSE_DELAY);
    },
    cancelSchedule: clearTimer,
    takeFocusRequest: () => {
      const requested = focusRequest.current;
      focusRequest.current = false;
      return requested;
    },
    restoreFocus: (value) => triggers.current.get(value)?.focus(),
  };

  return (
    <NavigationMenuContext value={context}>
      <nav
        ref={anchorRef}
        className={cn(
          "relative z-10 flex max-w-max flex-1 items-center justify-center",
          className
        )}
        {...props}>
        {children}
      </nav>
    </NavigationMenuContext>
  );
};

const NavigationMenuList = ({ className, ...props }: ComponentProps<"ul">) => (
  <ul
    className={cn(
      "flex flex-1 list-none items-center justify-center space-x-1",
      className
    )}
    {...props}
  />
);

const NavigationMenuItem = ({
  value: valueProp,
  children,
  ...props
}: ComponentProps<"li"> & { value?: string }) => {
  const menu = useNavigationMenu();
  const id = useId();
  const value = valueProp ?? id;
  return (
    <NavigationMenuItemContext value={value}>
      <li {...props}>
        <Popover
          isOpen={menu.isOpen && menu.value === value}
          onOpenChange={(isOpen) => (isOpen ? menu.show(value) : menu.hide())}>
          {children}
        </Popover>
      </li>
    </NavigationMenuItemContext>
  );
};

/** Opens its item's content on hover or ArrowDown; `onPress` is left to the caller. */
const NavigationMenuTrigger = ({
  className,
  children,
  onHoverStart,
  onHoverEnd,
  onKeyDown,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  children: ReactNode;
}) => {
  const menu = useNavigationMenu();
  const value = useNavigationMenuItem();
  return (
    <Button
      ref={(element) => {
        menu.registerTrigger(value, element);
        return () => menu.registerTrigger(value, null);
      }}
      variant="tertiary"
      className={cn("group", className)}
      onHoverStart={(event) => {
        onHoverStart?.(event);
        menu.scheduleShow(value);
      }}
      onHoverEnd={(event) => {
        onHoverEnd?.(event);
        menu.scheduleHide();
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.key === "ArrowDown") {
          event.preventDefault();
          menu.show(value, { focusContent: true });
        } else {
          event.continuePropagation();
        }
      }}
      {...props}>
      {children}
      <ChevronDown
        className="relative top-px size-3 transition duration-200 group-aria-expanded:rotate-180 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Button>
  );
};

const NavigationMenuContent = ({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) => {
  const menu = useNavigationMenu();
  const value = useNavigationMenuItem();
  const ref = useRef<HTMLDivElement>(null);
  const isActive = menu.isOpen && menu.value === value;
  const focusFirstLink = useEffectEvent(() => {
    if (menu.takeFocusRequest()) {
      ref.current?.querySelector<HTMLElement>("a[href], button")?.focus();
    }
  });
  useEffect(() => {
    if (isActive) focusFirstLink();
  }, [isActive]);

  return (
    <Popover.Content
      triggerRef={menu.anchorRef}
      isNonModal
      placement="bottom start"
      offset={6}
      // Only the active item's popover animates, and only when the menu opens or closes;
      // an item change is animated by the content instead.
      shouldSkipAnimation={
        menu.value !== value || (menu.isOpen && menu.motion !== null)
      }
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") menu.cancelSchedule();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") menu.scheduleHide();
      }}
      className="bg-surface/(--popover-opacity) text-overlay-foreground">
      <div
        ref={ref}
        data-motion={isActive ? (menu.motion ?? undefined) : undefined}
        className={cn(
          "data-motion:animate-in data-motion:fade-in data-motion:ease-smooth data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-motion:duration-150 motion-reduce:animate-none",
          className
        )}
        onKeyDown={(event) => {
          if (event.key === "Escape") menu.restoreFocus(value);
        }}
        onClick={(event) => {
          if (
            event.target instanceof Element &&
            event.target.closest("a[href]")
          ) {
            menu.hide();
          }
        }}>
        {children}
      </div>
    </Popover.Content>
  );
};

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
};
