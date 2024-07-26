"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  cn,
  Meteors,
  ShimmerButton,
} from "@chia/ui";
import { useRouter } from "next/navigation";
import { Form } from "@/app/contact/contact";
import { Link } from "@chia/ui";
import meta from "@chia/meta";
import { Controller } from "react-hook-form";
import { useId } from "react";
import { motion } from "framer-motion";
import { Input, Textarea } from "@nextui-org/react";

const ContactForm = () => {
  const router = useRouter();
  const id = useId();

  return (
    <Drawer open onClose={() => router.back()}>
      <DrawerContent className="c-bg-third flex w-full flex-col items-center p-5 pb-0">
        <div className="relative flex w-full flex-col items-center overflow-hidden">
          <Meteors number={20} />
          <DrawerHeader className="max-w-[700px]">
            <DrawerTitle>Contact</DrawerTitle>
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
                          label="Email"
                          placeholder="Your email"
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
                          label="Title"
                          placeholder="Your title"
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
                          label="Message"
                          name="message"
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          placeholder="Your message"
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
                <DrawerFooter className="prose dark:prose-invert flex max-w-[700px] flex-col items-center justify-center gap-1 pb-5 pt-1">
                  <ShimmerButton
                    shimmerSize="0.1em"
                    id={id + "-contact-submit"}
                    type="submit"
                    disabled={isPending}
                    className={cn("py-1", isPending && "cursor-not-allowed")}>
                    Send
                  </ShimmerButton>
                  <span className="flex gap-1">
                    or Via
                    <Link href={`mailto:${meta.email}`} className="flex w-fit">
                      email
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
  );
};

export default ContactForm;
