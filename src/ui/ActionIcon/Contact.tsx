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
import { motion } from "framer-motion";
import { cn } from "@chia//utils/cn.util";
import { Input, type InputRef, Textarea, type TextAreaRef } from "@chia/ui";
import { z } from "zod";
import {
  fetcher,
  type IApiResponse,
  ApiResponseStatus,
} from "@chia/utils/fetcher.util";
import { toast } from "sonner";
import { useAtom } from "jotai";
import { actionIconAtom } from "./store";

const Contact: FC = () => {
  const [{ isOpen }, handleActionSheet] = useAtom(actionIconAtom);
  const [isValidate, setIsValidate] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const id = useId();
  const emailRef = useRef<InputRef>(null);
  const messageRef = useRef<TextAreaRef>(null);
  const signal = useRef<AbortController>(new AbortController());

  useEffect(() => {
    signal.current = new AbortController();
    return () => {
      signal.current.abort();
    };
  }, []);

  const outside = {
    open: { opacity: 1, height: "470px", width: "330px" },
    closed: { opacity: 0, height: 0, width: 0, transition: { delay: 0.2 } },
  };
  const inside = {
    open: { opacity: 1, y: 0 },
    closed: { opacity: 0, y: 100 },
  };

  const handleSubmit = async (e: ChangeEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSending(true);
    const { data, status, message } = await fetcher<
      IApiResponse<{ message: string }>
    >({
      path: "/api/contact",
      requestInit: {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: emailRef?.current?.value,
          message: messageRef.current?.value,
        }),
        signal: signal.current.signal,
      },
    });
    if (status !== ApiResponseStatus.SUCCESS) {
      setIsSending(false);
      toast.error(
        message ?? "Sorry, something went wrong. Please try again later."
      );
      return;
    }
    setIsSending(false);
    toast.success(data?.message ?? "Message sent successfully.");
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
    <motion.div
      initial={"closed"}
      transition={{ duration: 0.7, type: "spring" }}
      animate={isOpen ? "open" : "closed"}
      variants={outside}
      className="px-3">
      <motion.div
        transition={{ duration: 0.7, type: "spring" }}
        animate={isOpen ? "open" : "closed"}
        variants={inside}
        className="flex h-full w-full flex-col items-center justify-start">
        <button
          aria-label={"Close contact"}
          onClick={() => handleActionSheet({ isOpen: !isOpen })}
          className="transition ease-in-out hover:text-secondary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        <form
          id={id + "-contact-form"}
          className="mx-auto flex w-full flex-col"
          onChange={validForm}
          onSubmit={handleSubmit}>
          <header className="mb-5 text-3xl">Contact Me</header>
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
              schema={z.string()}
            />
          </div>
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
      </motion.div>
    </motion.div>
  );
};

export default memo(Contact);
