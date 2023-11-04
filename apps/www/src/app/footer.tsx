"use client";

import type { FC, ReactNode } from "react";
import { Chia } from "@/shared/meta/chia";
import { SiGithub, SiInstagram, SiLinkedin } from "react-icons/si";
import { cn, useDarkMode } from "@chia/ui";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import navItems from "@/shared/routes";
import Link from "next/link";
import { Image } from "@chia/ui";

const LinkItem: FC<{
  path: string;
  icon: ReactNode;
  name: string;
  showIcon?: boolean;
}> = ({ path, icon, name, showIcon }) => {
  let pathname = usePathname() || "/";
  if (pathname.includes("/posts/")) {
    pathname = "/posts";
  }
  return (
    <Link
      key={path}
      href={path}
      className={cn(
        "flex align-middle transition-all hover:text-neutral-800 dark:hover:text-neutral-200",
        {
          "text-neutral-500": path !== pathname,
          "font-bold": path === pathname,
        }
      )}>
      <span className="relative flex items-center justify-center gap-2 px-[10px] py-[5px]">
        <div className={cn(showIcon ? "block" : "hidden")}>{icon}</div>
        <p className="">{name}</p>
        {path === pathname ? (
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
    icon: <SiGithub />,
    link: Chia.link.github,
  },
  instagram: {
    name: "Instagram",
    icon: <SiInstagram />,
    link: Chia.link.instagram,
  },
  linkedin: {
    name: "Linkedin",
    icon: <SiLinkedin />,
    link: Chia.link.linkedin,
  },
};

const Footer: FC = () => {
  const { isDarkMode } = useDarkMode();

  return (
    <footer className="c-bg-third relative flex min-h-[300px] flex-col items-center justify-center overflow-hidden py-8">
      <div className="c-container flex w-full px-10">
        <div className="hidden h-full min-h-[130px] w-1/3 flex-col items-start md:flex">
          <Image
            src="/icon.png"
            alt="logo"
            width={60}
            height={60}
            loading="lazy"
          />
          <p className="mt-auto">
            © {new Date(new Date().getTime()).getFullYear()}{" "}
            <span className="font-bold">{Chia.name}</span>
          </p>
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
        <Image
          src="/icon.png"
          alt="logo"
          width={60}
          height={60}
          loading="lazy"
        />
        <p className="">
          © {new Date(new Date().getTime()).getFullYear()}{" "}
          <span className="font-bold">{Chia.name}</span>
        </p>
      </div>
      <div
        className={cn(
          "absolute -bottom-[300px] -z-40 h-[450px] w-full max-w-[850px] rounded-full opacity-50 blur-3xl",
          isDarkMode
            ? "c-bg-gradient-purple-to-pink"
            : "c-bg-gradient-yellow-to-pink"
        )}
      />
    </footer>
  );
};

export default Footer;
