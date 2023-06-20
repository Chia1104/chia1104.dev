"use client";

import { type FC, useId, memo, useRef, useEffect, useState } from "react";
import { cn } from "ui";
import { Input, type InputRef, Textarea, type TextareaRef } from "ui";
import { z } from "zod";
import { fetcher, type IApiResponse } from "@/utils/fetcher.util";
import { toast } from "sonner";
import { RE_CAPTCHA_KEY } from "@/shared/constants";
import Script from "next/script";
import { useIsMounted, useDarkMode } from "@/hooks";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const Contact: FC = () => {
  const id = useId();
  const emailRef = useRef<InputRef>(null);
  const messageRef = useRef<TextareaRef>(null);
  const signal = useRef<AbortController>(new AbortController());
  const isMounted = useIsMounted();
  const { isDarkMode } = useDarkMode();
  const [isLoading, setIsLoading] = useState(false);

  const formSchema = z.strictObject({
    email: z.string().email(),
    title: z.string().min(5, "Title must be at least 5 characters long"),
    message: z.string().min(5, "Message must be at least 5 characters long"),
  });

  const {
    control,
    handleSubmit: onSubmit,
    formState: { errors, isValid },
  } = useForm({
    defaultValues: {
      email: "",
      title: "",
      message: "",
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    signal.current = new AbortController();
    return () => {
      signal.current.abort();
    };
  }, []);

  const handleSubmit = onSubmit(async (data, event) => {
    setIsLoading(true);
    const formData = new FormData(event?.target);
    const promise = () =>
      fetcher<{ message: string }>({
        dangerousThrow: true,
        path: "/api/contact",
        requestInit: {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
          body: formData,
          signal: signal.current.signal,
        },
      });
    toast.promise(promise, {
      loading: "Loading...",
      success: (
        data: IApiResponse<{
          message: string;
        }>
      ) => {
        return data?.data?.message ?? "Message sent successfully.";
      },
      error: (error: IApiResponse) => {
        return error?.message ?? "Sorry, something went wrong.";
      },
    });
    setIsLoading(false);
  });

  return (
    <div className="c-bg-secondary flex w-full max-w-[700px] flex-col items-center justify-start rounded-xl px-5 py-10 md:p-10">
      <form
        noValidate
        id={id + "-contact-form"}
        className="flex w-full flex-col gap-4"
        onSubmit={handleSubmit}>
        <header className="mb-5 flex gap-3 text-3xl">
          Contact Me{" "}
          <span className="animate-waving-hand inline-block origin-[70%_70%]">
            👋
          </span>
        </header>
        <div className="mb-3 flex flex-col gap-2">
          <Controller
            control={control}
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
                ref={emailRef}
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
        <div className="mb-3 flex flex-col gap-2">
          <Controller
            control={control}
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
                ref={emailRef}
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
        <div className="mb-3 flex flex-col gap-2">
          <Controller
            control={control}
            rules={{
              required: true,
            }}
            render={({
              field: { onChange, value, onBlur },
              fieldState: { invalid, error },
            }) => (
              <Textarea
                ref={messageRef}
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
        <Script
          id={id}
          src="https://www.google.com/recaptcha/api.js"
          async
          defer>
          {`
            const onloadCallback = function() {
              grecaptcha.reset();
            };
          `}
        </Script>
        <div
          className="g-recaptcha mb-5 mt-7 self-center"
          data-sitekey={RE_CAPTCHA_KEY}
          data-theme={isMounted && isDarkMode ? "dark" : "light"}
        />
        <button
          id={id + "-contact-submit"}
          type="submit"
          disabled={isLoading}
          className={cn(
            "c-bg-gradient-green-to-purple flex h-10 w-[85px] items-center justify-center self-center rounded-full text-white transition ease-in-out hover:scale-[1.05]",
            isLoading && "cursor-not-allowed"
          )}>
          Send
        </button>
      </form>
    </div>
  );
};

export default memo(Contact);
