"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, ViewTransition } from "react";
import { Controller } from "react-hook-form";

import { Input, Textarea } from "@heroui/react";
import { motion } from "framer-motion";

import meta from "@chia/meta";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@chia/ui/drawer";
import { Meteors } from "@chia/ui/meteors";
import ShimmerButton from "@chia/ui/shimmer-button";
import { cn } from "@chia/ui/utils/cn.util";

import { Form } from "@/components/contact/contact";

const Page = () => {
  const router = useRouter();
  const id = useId();
  const t = useTranslations("contact");
  const tForm = useTranslations("contact.form");

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
            <Form
              className="flex w-full flex-col items-center"
              disableRouterRefresh
              onSuccess={() => router.back()}
              render={({ controller, isPending, ReCAPTCHA }) => (
                <>
                  <div className="scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full flex h-[55vh] max-h-[550px] w-full max-w-[700px] flex-col gap-2 overflow-y-auto p-2">
                    <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
                      <Controller
                        control={controller}
                        rules={{
                          required: true,
                        }}
                        render={({
                          field: { onChange, value, onBlur },
                          fieldState: { invalid, error },
                        }) => (
                          <Input
                            isRequired
                            type="email"
                            label={tForm("email")}
                            placeholder={tForm("email-placeholder")}
                            isInvalid={invalid}
                            errorMessage={error?.message}
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            name="email"
                          />
                        )}
                        name="email"
                      />
                    </div>
                    <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
                      <Controller
                        control={controller}
                        rules={{
                          required: true,
                        }}
                        render={({
                          field: { onChange, value, onBlur },
                          fieldState: { invalid, error },
                        }) => (
                          <Input
                            isRequired
                            isInvalid={invalid}
                            errorMessage={error?.message}
                            type="text"
                            label={tForm("title")}
                            placeholder={tForm("title-placeholder")}
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            name="title"
                          />
                        )}
                        name="title"
                      />
                    </div>
                    <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
                      <Controller
                        control={controller}
                        rules={{
                          required: true,
                        }}
                        render={({
                          field: { onChange, value, onBlur },
                          fieldState: { invalid, error },
                        }) => (
                          <Textarea
                            isRequired
                            isInvalid={invalid}
                            label={tForm("message")}
                            name="message"
                            value={value}
                            onChange={onChange}
                            onBlur={onBlur}
                            placeholder={tForm("message-placeholder")}
                            errorMessage={error?.message}
                          />
                        )}
                        name="message"
                      />
                    </div>
                    <div className="w-fit self-center rounded-2xl">
                      {ReCAPTCHA}
                    </div>
                  </div>
                  <DrawerFooter className="prose dark:prose-invert flex max-w-[700px] flex-col items-center justify-center gap-1 pt-1 pb-5">
                    <ShimmerButton
                      shimmerSize="0.1em"
                      id={id + "-contact-submit"}
                      type="submit"
                      disabled={isPending}
                      className={cn("py-1", isPending && "cursor-not-allowed")}>
                      {tForm("send")}
                    </ShimmerButton>
                    <span className="flex gap-1">
                      {t("or-via")}
                      <Link
                        href={`mailto:${meta.email}`}
                        className="flex w-fit">
                        {tForm("email")}
                      </Link>
                    </span>
                  </DrawerFooter>
                </>
              )}
            />
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
