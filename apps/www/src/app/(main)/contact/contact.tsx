"use client";

import { type FC, useId, memo, useState } from "react";
import { cn } from "@chia/ui";
import { Input, Textarea, useDarkMode, Card } from "@chia/ui";
import { post, type HTTPError, handleKyError } from "@chia/utils";
import { toast } from "sonner";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { contactSchema, type Contact } from "@/shared/validator";
import dynamic from "next/dynamic";
import { env } from "@/env.mjs";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
});

const Contact: FC = () => {
  const id = useId();
  const { isDarkMode } = useDarkMode();
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const {
    control,
    handleSubmit: onSubmit,
    formState: { isSubmitting },
  } = useForm<Contact>({
    defaultValues: {
      email: "",
      title: "",
      message: "",
      reCaptchToken: "",
    },
    resolver: zodResolver(contactSchema),
  });

  const handleSubmit = onSubmit(async (data, event) => {
    setIsLoading(true);
    const promise = () =>
      post<void, Contact>("/api/v1/send", {
        title: data.title,
        email: data.email,
        message: data.message,
        reCaptchToken: data.reCaptchToken,
      });
    toast.promise<void>(promise, {
      loading: "Loading...",
      success: () => {
        setIsLoading(false);
        router.refresh();
        return "Message sent successfully.";
      },
      error: async (_error: HTTPError) => {
        const error = await handleKyError(_error);
        setIsLoading(false);
        return error.code ?? "Sorry, something went wrong.";
      },
    });
  });

  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[700px]",
      }}
      className="flex w-full max-w-[700px] flex-col items-center justify-start px-5 py-10 md:p-10">
      <form
        id={id + "-contact-form"}
        className="flex w-full flex-col gap-4"
        onSubmit={handleSubmit}>
        <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
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
            control={control}
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
        <div className="mb-5 mt-7 w-fit self-center rounded-2xl">
          <Controller
            control={control}
            rules={{
              required: true,
            }}
            render={({
              field: { onChange, value, onBlur },
              fieldState: { invalid, error },
            }) => (
              <div className="recaptcha-style">
                <ReCAPTCHA
                  placeholder="reCAPTCHA"
                  theme={isDarkMode ? "dark" : "light"}
                  sitekey={env.NEXT_PUBLIC_RE_CAPTCHA_KEY!}
                  onChange={(value) => {
                    onChange(value ?? "");
                  }}
                />
              </div>
            )}
            name="reCaptchToken"
          />
        </div>
        <button
          id={id + "-contact-submit"}
          type="submit"
          disabled={isLoading || isSubmitting}
          className={cn(
            "c-bg-gradient-green-to-purple flex h-10 w-[85px] items-center justify-center self-center rounded-full text-white transition ease-in-out hover:scale-[1.05]",
            isLoading && "cursor-not-allowed"
          )}>
          Send
        </button>
      </form>
    </Card>
  );
};

export default memo(Contact);
