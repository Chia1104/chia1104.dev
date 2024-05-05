"use client";

import { Image } from "@chia/ui";
import { Button } from "@nextui-org/react";
import { motion, AnimatePresence } from "framer-motion";
import { Boxes, Pencil, Settings2 } from "lucide-react";
import { type FC, type ReactNode, useRef } from "react";
import { useHover } from "usehooks-ts";
import { Link } from "next-view-transitions";

const SideBar: FC<{ children?: ReactNode }> = ({ children }) => {
  const asideRef = useRef(null);
  const isHover = useHover(asideRef);
  return (
    <div className="grid h-screen w-full pl-[56px]">
      <motion.aside
        whileHover={{
          width: 220,
        }}
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
          <Button
            as={Link}
            href="/"
            variant="flat"
            isIconOnly
            className="flex w-full rounded-lg"
            aria-label="Projct">
            <Boxes className="size-5" />
            <AnimatePresence>
              {isHover && (
                <motion.p
                  className="ml-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}>
                  Projct
                </motion.p>
              )}
            </AnimatePresence>
          </Button>
          <Button
            as={Link}
            href="/feed"
            variant="flat"
            isIconOnly
            className="flex w-full rounded-lg"
            aria-label="Feed">
            <Pencil className="size-5" />
            <AnimatePresence>
              {isHover && (
                <motion.p
                  className="ml-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}>
                  Feed
                </motion.p>
              )}
            </AnimatePresence>
          </Button>
          <Button
            as={Link}
            href="/setting"
            variant="flat"
            isIconOnly
            className="mt-auto flex w-full rounded-lg"
            aria-label="Setting">
            <Settings2 className="size-5" />
            <AnimatePresence>
              {isHover && (
                <motion.p
                  className="ml-2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}>
                  Setting
                </motion.p>
              )}
            </AnimatePresence>
          </Button>
        </nav>
      </motion.aside>
      <div className="flex flex-col">{children}</div>
    </div>
  );
};

export default SideBar;
