"use client";

import { useId, memo, useState } from "react";
import type {
  FC,
  ComponentPropsWithoutRef,
  ReactNode,
  ReactElement,
} from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Textarea } from "@nextui-org/react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import type { Control } from "react-hook-form";
import { toast } from "sonner";

import { cn } from "@chia/ui";
import { Card, useTheme, ShimmerButton } from "@chia/ui";
import { post, handleKyError } from "@chia/utils";
import type { HTTPError } from "@chia/utils";

import { env } from "@/env";
import { contactSchema } from "@/shared/validator";
import type { Contact } from "@/shared/validator";

// @ts-expect-error - legacy class component
const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
});

export const Form: FC<
  ComponentPropsWithoutRef<"form"> & {
    onSuccess?: () => void;
    onError?: (error: HTTPError) => void;
    disableRouterRefresh?: boolean;
    render?: ({
      controller,
      isPending,
      ReCAPTCHA,
    }: {
      controller: Control<
        {
          title: string;
          message: string;
          email: string;
          reCaptchToken: string;
        },
        any
      >;
      isPending: boolean;
      ReCAPTCHA: ReactElement;
    }) => ReactNode;
  }
> = ({
  className,
  onSuccess,
  onError,
  disableRouterRefresh = false,
  render,
  ...props
}) => {
  const id = useId();
  const { isDarkMode } = useTheme();
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

  const handleSubmit = onSubmit((data) => {
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
        if (!disableRouterRefresh) router.refresh();
        onSuccess?.();
        return "Message sent successfully.";
      },
      error: async (_error: HTTPError) => {
        const error = await handleKyError(_error);
        onError?.(_error);
        setIsLoading(false);
        return error.code ?? "Sorry, something went wrong.";
      },
    });
  });
  return (
    <form
      id={id + "-contact-form"}
      className={cn("flex w-full flex-col gap-4", className)}
      {...props}
      onSubmit={handleSubmit}>
      {render ? (
        render({
          controller: control,
          isPending: isLoading,
          ReCAPTCHA: (
            <Controller
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange } }) => (
                <div className="recaptcha-style">
                  <ReCAPTCHA
                    theme={isDarkMode ? "dark" : "light"}
                    sitekey={env.NEXT_PUBLIC_RE_CAPTCHA_KEY}
                    onChange={(value) => {
                      onChange(value ?? "");
                    }}
                  />
                </div>
              )}
              name="reCaptchToken"
            />
          ),
        })
      ) : (
        <>
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
              control={control}
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
              control={control}
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
            <Controller
              control={control}
              rules={{
                required: true,
              }}
              render={({ field: { onChange } }) => (
                <div className="recaptcha-style">
                  <ReCAPTCHA
                    theme={isDarkMode ? "dark" : "light"}
                    sitekey={env.NEXT_PUBLIC_RE_CAPTCHA_KEY}
                    onChange={(value) => {
                      onChange(value ?? "");
                    }}
                  />
                </div>
              )}
              name="reCaptchToken"
            />
          </div>
          <ShimmerButton
            shimmerSize="0.1em"
            id={id + "-contact-submit"}
            type="submit"
            disabled={isLoading || isSubmitting}
            className={cn(
              "w-fit self-center py-2",
              isLoading && "cursor-not-allowed"
            )}>
            Send
          </ShimmerButton>
        </>
      )}
    </form>
  );
};

const Contact: FC = () => {
  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[700px]",
      }}
      className="flex w-full max-w-[700px] flex-col items-center justify-start px-5 py-10 md:p-10">
      <Form />
    </Card>
  );
};

export default memo(Contact);
