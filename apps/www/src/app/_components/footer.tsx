"use client";

import type { FC, ReactNode } from "react";
import { cn, Link, ThemeSelector } from "@chia/ui";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import navItems from "@/shared/routes";
import contact from "@/shared/contact";
import { Image } from "@chia/ui";
import meta from "@chia/meta";

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
  preview?: boolean;
}> = ({ path, icon, name, showIcon, preview }) => {
  const pathname = usePathname() || "/";
  const isActive = pathname.includes(path);
  return (
    <Link
      preview={preview}
      key={path}
      href={path}
      className={cn(
        "flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200",
        {
          "dark:text-popover-foreground text-neutral-500": !isActive,
          "font-bold": isActive,
        }
      )}>
      <span className="relative flex items-center justify-center gap-2 px-[10px] py-[5px]">
        <div className={cn(showIcon ? "block" : "hidden")}>{icon}</div>
        <p className="">{name}</p>
        {isActive ? (
          <motion.div
            className="bg-accent absolute inset-0 z-[-1] rounded-md"
            layoutId="footer"
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

const Copyright: FC<{ className?: string }> = ({ className }) => (
  <p className={className}>
    © {new Date().getFullYear()} <span className="font-bold">{meta.name}</span>
  </p>
);

const Logo = () => (
  <Image src="/icon.png" alt="logo" width={60} height={60} loading="lazy" />
);

const Footer: FC = () => {
  return (
    <footer
      data-testid="footer"
      className="c-bg-third relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden py-8">
      <div className="c-container flex w-full px-10">
        <div className="hidden h-full min-h-[130px] w-1/3 flex-col items-start gap-5 md:flex">
          <Logo />
          <ThemeSelector />
          <Copyright className="mt-auto" />
        </div>
        <div className="flex w-1/2 flex-col items-start md:w-1/3">
          <p className="mb-3 ml-2 text-lg font-bold">Pages</p>
          {Object.entries(navItems).map(([path, { name, icon }]) => (
            <LinkItem key={path} path={path} name={name} icon={icon} />
          ))}
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
      <motion.div
        whileInView={{
          opacity: "50%",
        }}
        initial={{
          opacity: "0%",
        }}
        transition={{
          delay: 0.3,
          duration: 0.7,
        }}
        className={cn(
          "dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -bottom-[300px] -z-40 h-[450px] w-full max-w-[850px] rounded-full blur-3xl"
        )}
      />
    </footer>
  );
};

export default Footer;
