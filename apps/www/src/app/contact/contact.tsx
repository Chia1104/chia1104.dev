"use client";

import {
  type FC,
  useId,
  memo,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type ReactElement,
} from "react";
import { cn } from "@chia/ui";
import { Input, Textarea, Card, useTheme, ShimmerButton } from "@chia/ui";
import { post, type HTTPError, handleKyError } from "@chia/utils";
import { toast } from "sonner";
import { useForm, Controller, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { contactSchema, type Contact } from "@/shared/validator";
import dynamic from "next/dynamic";
import { env } from "@/env";

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
        !disableRouterRefresh && router.refresh();
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
                    sitekey={env.NEXT_PUBLIC_RE_CAPTCHA_KEY!}
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
