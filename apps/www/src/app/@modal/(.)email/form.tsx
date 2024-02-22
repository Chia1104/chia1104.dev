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
  useTheme,
} from "@chia/ui";
import { useRouter } from "next/navigation";
import { Form } from "@/app/contact/contact";
import { Link, Input, Textarea } from "@chia/ui";
import meta from "@chia/meta";
import { Controller } from "react-hook-form";
import { useId } from "react";

const ContactForm = () => {
  const router = useRouter();
  const id = useId();
  const { isDarkMode } = useTheme();

  return (
    <Drawer open onClose={() => router.back()}>
      <DrawerContent className="c-bg-third flex w-full flex-col items-center p-5">
        <div className="relative flex w-full flex-col items-center">
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
                <div className="scrollbar-thin dark:scrollbar-thumb-dark scrollbar-thumb-light scrollbar-thumb-rounded-full flex h-[65vh] max-h-[650px] w-full max-w-[700px] flex-col gap-2 overflow-y-auto px-2 py-2">
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
                          titleClassName="text-xl"
                          className="focus:border-info focus:shadow-info/40 dark:focus:border-info dark:focus:shadow-info/40"
                          isValid={!invalid}
                          errorMessage={error?.message}
                          type="email"
                          title="Email"
                          placeholder="Your email"
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
                          titleClassName="text-xl"
                          className="focus:border-info focus:shadow-info/40 dark:focus:border-info dark:focus:shadow-info/40"
                          isValid={!invalid}
                          errorMessage={error?.message}
                          type="text"
                          title="Title"
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
                          className="focus:border-info focus:shadow-info/40 dark:focus:border-info dark:focus:shadow-info/40 h-40 max-h-40 p-3"
                          title="Message"
                          name="message"
                          value={value}
                          onChange={onChange}
                          onBlur={onBlur}
                          placeholder="Your message"
                          titleClassName="text-xl"
                          errorMessage={error?.message}
                          isValid={!invalid}
                        />
                      )}
                      name="message"
                    />
                  </div>
                  <div className="w-fit self-center rounded-2xl">
                    {ReCAPTCHA}
                  </div>
                </div>
                <DrawerFooter className="prose dark:prose-invert flex max-w-[700px] flex-col items-center justify-center gap-1 py-1">
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
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ContactForm;
