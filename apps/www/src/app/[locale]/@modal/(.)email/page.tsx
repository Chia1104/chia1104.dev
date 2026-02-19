"use client";

import { useRouter } from "next/navigation";
import { ViewTransition } from "react";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@chia/ui/drawer";
import { Meteors } from "@chia/ui/meteors";
import { cn } from "@chia/ui/utils/cn.util";

import { ContactForm } from "@/components/contact/contact";

const Page = () => {
  const router = useRouter();
  const t = useTranslations("contact");

  return (
    <ViewTransition>
      <Drawer open onClose={() => router.back()}>
        <DrawerContent className="c-bg-third flex w-full flex-col items-center p-5 pb-0">
          <div className="relative flex w-full flex-col items-center overflow-hidden">
            <Meteors number={20} />
            <DrawerHeader className="max-w-[700px]">
              <DrawerTitle>{t("title")}</DrawerTitle>
              <DrawerClose />
            </DrawerHeader>
            <div className="scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full flex w-full max-w-[700px] flex-col gap-2 overflow-y-auto p-2">
              <ContactForm />
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
          </div>
        </DrawerContent>
      </Drawer>
    </ViewTransition>
  );
};

export default Page;
