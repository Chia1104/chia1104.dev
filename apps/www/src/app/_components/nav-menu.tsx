"use client";

import { type FC } from "react";
import Link from "next/link";
import {
  cn,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  useCMD,
  Theme,
  MotionThemeIcon,
  defaultThemeVariants,
  useTheme,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Button,
} from "@chia/ui";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import navItems from "@/shared/routes";
import contact from "@/shared/contact";
import capitalize from "lodash/capitalize";

const CMDK = () => {
  const [open, setOpen] = useCMD();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => setOpen(true)} size="sm" variant="ghost">
              <div className="i-mdi-hamburger size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
              <span className="text-xs">⌘</span>K
            </kbd>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {Object.entries(navItems).map(([path, { name }]) => {
              return (
                <CommandItem
                  className="gap-5"
                  key={path}
                  onSelect={() => {
                    router.push(path);
                    setOpen(false);
                  }}>
                  <div className="i-mdi-paper size-5" />
                  {name}
                </CommandItem>
              );
            })}
          </CommandGroup>
          <CommandSeparator className="mb-2" />
          <CommandGroup
            heading={
              <span className="flex items-center justify-between">
                <p>Contact</p>
                <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>I
                </kbd>
              </span>
            }>
            {Object.entries(contact).map(([key, { name, icon, link }]) => (
              <CommandItem
                className="gap-5"
                key={key}
                onSelect={() => {
                  window.open(link, "_blank");
                  setOpen(false);
                }}>
                {icon}
                {name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator className="mb-2" />
          <CommandGroup
            heading={
              <span className="flex items-center justify-between">
                <p>Theme ({capitalize(theme)})</p>
                <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100">
                  <span className="text-xs">⌘</span>J
                </kbd>
              </span>
            }>
            <CommandItem
              defaultChecked={theme === Theme.SYSTEM}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.SYSTEM);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.SYSTEM}
                variants={defaultThemeVariants}
              />
              System
            </CommandItem>
            <CommandItem
              defaultChecked={theme === Theme.DARK}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.DARK);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.DARK}
                variants={defaultThemeVariants}
              />
              Dark
            </CommandItem>
            <CommandItem
              defaultChecked={theme === Theme.LIGHT}
              className="gap-5"
              onSelect={() => {
                setTheme(Theme.LIGHT);
                setOpen(false);
              }}>
              <MotionThemeIcon
                theme={Theme.LIGHT}
                variants={defaultThemeVariants}
              />
              Light
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
};

const NavMenu: FC = () => {
  const pathname = usePathname() || "/";
  return (
    <nav className="c-bg-third fixed top-0 z-50 flex h-[75px] w-screen items-center justify-center">
      <div className="container flex w-[100%] px-5">
        <div className="flex w-[20%] items-center text-2xl">
          <Link
            href="/"
            scroll
            className="subtitle hover:c-text-green-to-purple ml-3 transition ease-in-out">
            Chia1104
          </Link>
        </div>
        <LayoutGroup>
          <div className="mr-3 flex w-[80%] items-center justify-end">
            {Object.entries(navItems).map(([path, { name, icon }]) => {
              const isActive = pathname.includes(path);
              return (
                <Link
                  key={path}
                  href={path}
                  className={cn(
                    "flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200",
                    {
                      "dark:text-popover-foreground text-neutral-500":
                        !isActive,
                      "font-bold": isActive,
                    }
                  )}>
                  <span className="relative px-[10px] py-[5px]">
                    <p className="hidden md:block">{name}</p>
                    <div className="block md:hidden">{icon}</div>
                    {isActive ? (
                      <motion.div
                        className="bg-accent absolute inset-0 z-[-1] rounded-md"
                        layoutId="nav-menu"
                        transition={{
                          type: "spring",
                          stiffness: 350,
                          damping: 30,
                        }}
                      />
                    ) : null}
                  </span>
                </Link>
              );
            })}
            <CMDK />
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
};

export default NavMenu;
