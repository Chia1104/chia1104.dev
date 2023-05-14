"use client";

import {
  type FC,
  useId,
  memo,
  useRef,
  useState,
  type ChangeEvent,
  useEffect,
} from "react";
import { cn } from "ui";
import { Input, type InputRef, Textarea, type TextAreaRef } from "ui";
import { z } from "zod";
import { fetcher, type IApiResponse } from "@/utils/fetcher.util";
import { toast } from "sonner";
import { RE_CAPTCHA_KEY } from "@/shared/constants";
import Script from "next/script";
import { useIsMounted, useDarkMode } from "@/hooks";

const Contact: FC = () => {
  const [isValidate, setIsValidate] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const id = useId();
  const emailRef = useRef<InputRef>(null);
  const messageRef = useRef<TextAreaRef>(null);
  const signal = useRef<AbortController>(new AbortController());
  const isMounted = useIsMounted();
  const { isDarkMode } = useDarkMode();

  useEffect(() => {
    signal.current = new AbortController();
    return () => {
      signal.current.abort();
    };
  }, []);

  const handleSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
    const formData = new FormData(e.target);
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
        setIsSending(false);
        return data?.data?.message ?? "Message sent successfully.";
      },
      error: (error: IApiResponse) => {
        setIsSending(false);
        return error?.message ?? "Sorry, something went wrong.";
      },
    });
  };

  const validForm = () => {
    const email = emailRef.current?.isValid();
    const message = messageRef.current?.isValid();
    if (!email || !message) {
      setIsValidate(false);
      return;
    }
    setIsValidate(true);
  };

  return (
    <div className="c-bg-secondary flex w-full max-w-[700px] flex-col items-center justify-start rounded-xl px-5 py-10 md:p-10">
      <form
        id={id + "-contact-form"}
        className="flex w-full flex-col"
        onChange={validForm}
        onSubmit={handleSubmit}>
        <header className="mb-5 flex gap-3 text-3xl">
          Contact Me{" "}
          <span className="animate-waving-hand inline-block origin-[70%_70%]">
            👋
          </span>
        </header>
        <div className="mb-3 flex flex-col gap-2">
          <Input
            ref={emailRef}
            title="Email"
            name="email"
            required
            titleClassName="text-xl"
            schema={z.string().email()}
            placeholder="Your email"
            error="Please enter a valid email"
            type="email"
          />
        </div>
        <div className="mb-3 flex flex-col gap-2">
          <Textarea
            ref={messageRef}
            className="h-40 max-h-40 p-3"
            title="Message"
            name="message"
            placeholder="Your message"
            titleClassName="text-xl"
            schema={z.string().min(1)}
            error="Please enter a message"
            required
          />
        </div>
        <Script
          id={id}
          src="https://www.google.com/recaptcha/api.js"
          async
          defer>
          {`
            const onloadCallback = function() {
              console.log("reCAPTCHA has loaded!");
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
          disabled={!isValidate || isSending}
          className={cn(
            "c-bg-gradient-green-to-purple flex h-10 w-[85px] items-center justify-center self-center rounded-full text-white transition ease-in-out hover:scale-[1.05]",
            (!isValidate || isSending) && "cursor-not-allowed"
          )}>
          Send
        </button>
      </form>
    </div>
  );
};

export default memo(Contact);
