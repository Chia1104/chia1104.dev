"use client";

import type { FC } from "react";

import { Tabs, Tab, Tooltip, Button, Kbd } from "@nextui-org/react";
import capitalize from "lodash/capitalize";
import { useRouter, useSelectedLayoutSegments } from "next/navigation";

import {
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
  Link,
} from "@chia/ui";

import contact from "@/shared/contact";
import navItems from "@/shared/routes";

const CMDK = () => {
  const [open, setOpen] = useCMD();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  return (
    <>
      <Tooltip
        delay={300}
        content={
          <Kbd keys={["command"]} className="text-xs">
            K
          </Kbd>
        }
        placement="bottom">
        <Button
          size="sm"
          isIconOnly
          onPress={() => setOpen(true)}
          aria-label="CMD">
          <div className="i-mdi-hamburger size-4" />
        </Button>
      </Tooltip>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Pages">
            {Object.entries(navItems).map(([path, { name }]) => {
              return (
                <CommandItem
                  aria-label={name}
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
                <Kbd className="text-xs" keys={["command"]}>
                  I
                </Kbd>
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
                <Kbd keys={["command"]} className="text-xs">
                  J
                </Kbd>
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
  const selectedLayoutSegments = useSelectedLayoutSegments();
  return (
    <nav className="c-bg-third fixed top-0 z-50 flex h-[75px] w-screen items-center justify-center">
      <div className="container flex w-full justify-between px-5">
        <div className="flex w-1/5 items-center text-2xl">
          <Link
            experimental={{
              enableViewTransition: true,
            }}
            href="/"
            scroll
            className="subtitle hover:c-text-green-to-purple ml-3 transition ease-in-out">
            Chia1104
          </Link>
        </div>
        <div className="flex w-fit items-center">
          <Tabs
            variant="light"
            aria-label="nav bar"
            className="w-fit"
            selectedKey={selectedLayoutSegments[0] ?? "/"}>
            {Object.entries(navItems).map(
              ([path, { name, icon, hiddenInMainMenu }]) => {
                if (hiddenInMainMenu) return null;
                return (
                  <Tab
                    key={path.replace(/^\//, "")}
                    title={
                      <Link
                        experimental={{
                          enableViewTransition: true,
                        }}
                        key={path}
                        href={path}>
                        <span className="relative px-[10px] py-[5px]">
                          <p className="hidden md:block">{name}</p>
                          <div className="block md:hidden">{icon}</div>
                        </span>
                      </Link>
                    }
                  />
                );
              }
            )}
          </Tabs>
          <CMDK />
        </div>
      </div>
    </nav>
  );
};

export default NavMenu;
