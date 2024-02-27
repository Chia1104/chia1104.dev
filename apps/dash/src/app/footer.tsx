"use client";

import type { FC, ReactNode } from "react";
import {
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@nextui-org/react";
import {
  cn,
  Image,
  MotionThemeIcon,
  defaultThemeVariants,
  useTheme,
  Theme,
} from "@chia/ui";
import meta from "@chia/meta";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const ThemeSelector = () => {
  const { theme, setTheme } = useTheme();
  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="flat"
          size="sm"
          startContent={
            <MotionThemeIcon
              theme={theme as Theme}
              variants={defaultThemeVariants}
            />
          }>
          Theme
        </Button>
      </DropdownTrigger>
      <DropdownMenu>
        <DropdownItem
          key="system"
          startContent={
            <MotionThemeIcon
              theme={Theme.SYSTEM}
              variants={defaultThemeVariants}
            />
          }
          onPress={(e) => setTheme(Theme.SYSTEM)}>
          System
        </DropdownItem>
        <DropdownItem
          key="dark"
          startContent={
            <MotionThemeIcon
              theme={Theme.DARK}
              variants={defaultThemeVariants}
            />
          }
          onPress={(e) => setTheme(Theme.DARK)}>
          Dark
        </DropdownItem>
        <DropdownItem
          key="light"
          startContent={
            <MotionThemeIcon
              theme={Theme.LIGHT}
              variants={defaultThemeVariants}
            />
          }
          onPress={(e) => setTheme(Theme.LIGHT)}>
          Light
        </DropdownItem>
      </DropdownMenu>
    </Dropdown>
  );
};

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
}> = ({ path, icon, name, showIcon }) => {
  const pathname = usePathname() || "/";
  const isActive = pathname.includes(path);
  return (
    <Link
      key={path}
      href={path}
      className={cn(
        "flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200",
        {
          "text-neutral-500": !isActive,
          "font-bold": isActive,
        }
      )}>
      <span className="relative flex items-center justify-center gap-2 px-[10px] py-[5px]">
        <div className={cn(showIcon ? "block" : "hidden")}>{icon}</div>
        <p className="">{name}</p>
        {isActive ? (
          <motion.div
            className="absolute inset-0 z-[-1] rounded-md bg-[#dddddd] dark:bg-black/60"
            layoutId="sidebar"
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
};

const contact = {
  github: {
    name: "Github",
    icon: <span className="i-mdi-github h-6 w-6" />,
    link: meta.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <span className="i-mdi-instagram h-6 w-6" />,
    link: meta.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <span className="i-mdi-linkedin h-6 w-6" />,
    link: meta.link.linkedin,
  },
};

const Copyright: FC<{ className?: string }> = ({ className }) => (
  <p className={className}>
    © {new Date().getFullYear()} <span className="font-bold">{meta.name}</span>
  </p>
);

const Logo = () => (
  <Image src="/logo.png" alt="logo" width={60} height={60} loading="lazy" />
);

const Footer: FC = () => {
  return (
    <footer className="footer">
      <div className="c-container flex w-full px-10">
        <div className="hidden h-full min-h-[130px] w-1/3 flex-col items-start gap-5 md:flex">
          <Logo />
          <ThemeSelector />
          <Copyright className="mt-auto" />
        </div>
        <div className="flex w-1/2 flex-col items-start md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">Contact</p>
          {Object.entries(contact).map(([key, { name, icon, link }]) => (
            <LinkItem key={key} path={link} name={name} icon={icon} showIcon />
          ))}
        </div>
      </div>
      <div className="c-container mt-5 flex w-full items-center justify-between px-10 md:hidden">
        <div className="flex items-center gap-5">
          <Logo />
          <ThemeSelector />
        </div>
        <Copyright />
      </div>
      <div
        className={cn(
          "dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -bottom-[300px] -z-40 h-[450px] w-full max-w-[850px] rounded-full opacity-50 blur-3xl"
        )}
      />
    </footer>
  );
};

export default Footer;
