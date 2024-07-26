"use client";

import { useRef } from "react";
import type { FC, ReactNode } from "react";

import { motion, AnimatePresence } from "framer-motion";
import { Boxes, Pencil, Settings2 } from "lucide-react";
import { useHover } from "usehooks-ts";

import { Image, Link, cn, useIsMobile } from "@chia/ui";

const LinkItem: FC<{
  name: string;
  href: string;
  className?: string;
  isHover?: boolean;
  icon?: ReactNode;
}> = ({ name, href, className, icon, isHover }) => {
  return (
    <Link
      href={href}
      experimental={{
        enableViewTransition: true,
      }}
      className={cn(
        "hover:bg-default/40 duration-250 relative flex h-9 w-full items-center rounded-lg px-[0.9rem] py-2 transition-colors",
        className
      )}
      aria-label={name}>
      {icon}
      <AnimatePresence>
        {isHover && (
          <motion.p
            className="ml-2 text-sm font-semibold"
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}>
            {name}
          </motion.p>
        )}
      </AnimatePresence>
    </Link>
  );
};

const SideBar: FC<{ children?: ReactNode }> = ({ children }) => {
  const asideRef = useRef(null);
  const isHover = useHover(asideRef);
  const isMobile = useIsMobile();
  return (
    <div className="grid h-screen w-full pl-[56px]">
      <motion.aside
        whileHover={
          !isMobile
            ? {
                width: 220,
              }
            : undefined
        }
        ref={asideRef}
        className="c-bg-third inset-y group fixed left-0 z-30 flex h-full flex-col items-center border-r">
        <div className="flex w-full justify-normal border-b p-2">
          <Image
            src="/logo.png"
            alt="chia1104"
            width={50}
            height={50}
            blur={false}
          />
        </div>
        <nav className="flex size-full flex-col items-center gap-1 p-2">
          <LinkItem
            name="Projects"
            href="/"
            isHover={!isMobile ? isHover : false}
            icon={<Boxes className="size-5" />}
          />
          <LinkItem
            name="Feed"
            href="/feed"
            isHover={!isMobile ? isHover : false}
            icon={<Pencil className="size-5" />}
          />
          <LinkItem
            name="Setting"
            href="/setting"
            className={cn("mt-auto")}
            isHover={!isMobile ? isHover : false}
            icon={<Settings2 className="size-5" />}
          />
        </nav>
      </motion.aside>
      <div className="flex flex-col">{children}</div>
    </div>
  );
};

export default SideBar;
