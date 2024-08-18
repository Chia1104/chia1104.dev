"use client";

import { useRef, useTransition } from "react";
import type { FC, ReactNode } from "react";

import {
  Avatar,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@nextui-org/react";
import { motion } from "framer-motion";
import { Boxes, Pencil, Settings2, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { useSelectedLayoutSegments } from "next/navigation";
import { useHover } from "usehooks-ts";

import { Link, cn, useIsMobile, ThemeSelector } from "@chia/ui";

import AuthGuard from "@/components/auth-guard/index.client";

const SideBar: FC<{ children?: ReactNode }> = ({ children }) => {
  const asideRef = useRef(null);
  const isHover = useHover(asideRef);
  const isMobile = useIsMobile();
  const [, startTransition] = useTransition();
  const selectedLayoutSegments = useSelectedLayoutSegments();
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
        className="c-bg-third inset-y group fixed left-0 z-30 flex h-full flex-col items-center py-5">
        <div className="flex flex-col w-full items-center pt-5 px-[6px] mb-5 gap-3">
          <div className="w-full px-[6px] flex gap-5 items-center">
            <AuthGuard
              fallback={
                <Avatar
                  isBordered
                  as="button"
                  className="transition-transform"
                  color="secondary"
                  size="sm"
                />
              }>
              {(session) => (
                <>
                  <Avatar
                    isBordered
                    as="button"
                    className="transition-transform"
                    color="secondary"
                    size="sm"
                    src={session.user?.image ?? ""}
                  />
                  {isMobile ? null : isHover ? (
                    <p className="line-clamp-1">{session.user.name}</p>
                  ) : null}
                </>
              )}
            </AuthGuard>
          </div>
          <ThemeSelector
            enableCMD
            label={isMobile ? "" : isHover ? "Theme" : ""}
            buttonProps={{
              isIconOnly: isMobile ? true : !isHover,
              className: cn("transition-all w-full"),
              variant: "flat",
              size: "md",
            }}
          />
        </div>
        <nav className="flex size-full flex-col items-center gap-2 px-[6px] py-2">
          <Button
            as={Link}
            experimental={{
              enableViewTransition: true,
            }}
            href="/"
            variant={selectedLayoutSegments.length === 0 ? "flat" : "light"}
            className="w-full"
            isIconOnly={isMobile ? true : !isHover}>
            {isMobile ? (
              <Boxes className="size-5" />
            ) : isHover ? (
              <>
                <Boxes className="size-5" />
                Projects
              </>
            ) : (
              <Boxes className="size-5" />
            )}
          </Button>
          <Button
            as={Link}
            experimental={{
              enableViewTransition: true,
            }}
            href="/feed"
            variant={selectedLayoutSegments[0] === "feed" ? "flat" : "light"}
            className="w-full"
            isIconOnly={isMobile ? true : !isHover}>
            {isMobile ? (
              <Pencil className="size-5" />
            ) : isHover ? (
              <>
                <Pencil className="size-5" />
                Feed
              </>
            ) : (
              <Pencil className="size-5" />
            )}
          </Button>
          <Button
            as={Link}
            experimental={{
              enableViewTransition: true,
            }}
            href="/setting"
            variant={selectedLayoutSegments[0] === "setting" ? "flat" : "light"}
            className="w-full mt-auto"
            isIconOnly={isMobile ? true : !isHover}>
            {isMobile ? (
              <Settings2 className="size-5" />
            ) : isHover ? (
              <>
                <Settings2 className="size-5" />
                Setting
              </>
            ) : (
              <Settings2 className="size-5" />
            )}
          </Button>
          <Popover backdrop="blur">
            <PopoverTrigger>
              <Button
                variant="flat"
                color={isMobile ? "danger" : isHover ? "danger" : "default"}
                className="transition-all w-full"
                isIconOnly={isMobile ? true : !isHover}>
                {isMobile ? (
                  <LogOut className="size-5" />
                ) : isHover ? (
                  "Sign Out"
                ) : (
                  <LogOut className="size-5" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-4 gap-3">
              <div className="text-small font-bold">
                Are you sure you want to sign out?
              </div>
              <Button
                color="danger"
                variant="flat"
                onPress={() => startTransition(() => signOut())}>
                Sign Out
              </Button>
            </PopoverContent>
          </Popover>
        </nav>
      </motion.aside>
      <div className="flex flex-col">{children}</div>
    </div>
  );
};

export default SideBar;
