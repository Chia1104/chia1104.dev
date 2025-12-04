"use client";

import { useId, memo } from "react";
import type {
  FC,
  ComponentPropsWithoutRef,
  ReactNode,
  ReactElement,
} from "react";

import { Input, Textarea } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { useLocale } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { toast } from "sonner";

import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha";
import { ErrorCode as CaptchaErrorCode } from "@chia/api/captcha";
import Card from "@chia/ui/card";
import { Form as _Form, FormField, FormItem, FormMessage } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";
import { getServiceEndPoint } from "@chia/utils";
import { post, handleKyError } from "@chia/utils";

import { env } from "@/env";
import { contactSchema } from "@/shared/validator";
import type { Contact } from "@/shared/validator";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
});
const Turnstile = dynamic(() =>
  import("@marsidev/react-turnstile").then((mod) => mod.Turnstile)
);

const CaptchaField = ({
  control,
}: {
  control: Control<Contact, "captchaToken">;
}) => {
  const { isDarkMode } = useTheme();
  const locale = useLocale();
  return (
    <FormField
      control={control}
      name="captchaToken"
      render={({ field }) => (
        <FormItem>
          {env.NEXT_PUBLIC_CAPTCHA_PROVIDER === "google-recaptcha" ? (
            <div className="recaptcha-style">
              <ReCAPTCHA
                key={isDarkMode ? "dark" : "light"}
                theme={isDarkMode ? "dark" : "light"}
                sitekey={env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}
                onChange={(value) => {
                  field.onChange(value ?? "");
                }}
                onReset={() => {
                  field.onChange("");
                }}
              />
            </div>
          ) : (
            <Turnstile
              options={{
                theme: isDarkMode ? "dark" : "light",
                language: locale,
              }}
              siteKey={env.NEXT_PUBLIC_CAPTCHA_SITE_KEY}
              onSuccess={(data) => {
                field.onChange(data);
              }}
              tw=""
            />
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export const Form: FC<
  ComponentPropsWithoutRef<"form"> & {
    onSuccess?: () => void;
    onError?: (error: Error) => void;
    disableRouterRefresh?: boolean;
    render?: ({
      controller,
      isPending,
      ReCAPTCHA,
    }: {
      controller: Control<Contact>;
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
  const router = useRouter();
  const { mutateAsync, isPending } = useMutation<void, Error, Contact>({
    mutationFn: (data) =>
      post<void, Omit<Contact, "captchaToken">>(
        "email/send",
        {
          title: data.title,
          email: data.email,
          message: data.message,
        },
        {
          headers: {
            [X_CAPTCHA_RESPONSE]: data.captchaToken,
          },
          prefixUrl: getServiceEndPoint(),
        }
      ),
  });

  const form = useForm<Contact>({
    defaultValues: {
      email: "",
      title: "",
      message: "",
      captchaToken: "",
    },
    resolver: zodResolver(contactSchema),
  });

  const handleSubmit = form.handleSubmit((data) => {
    toast.promise<void>(() => mutateAsync(data), {
      loading: "Loading...",
      success: () => {
        if (!disableRouterRefresh) router.refresh();
        onSuccess?.();
        return "Message sent successfully.";
      },
      error: async (_error: Error) => {
        onError?.(_error);
        if (_error instanceof HTTPError) {
          const error = await handleKyError(_error);

          switch (error.errors?.[0]?.message) {
            case CaptchaErrorCode.CaptchaFailed:
              return "Failed to validate captcha";
            case CaptchaErrorCode.CaptchaProviderNotSupported:
              return "Captcha provider not supported";
            case CaptchaErrorCode.CaptchaRequired:
              return "Captcha is required";
            default:
              return "Failed to send email";
          }
        }
      },
    });
  });

  return (
    <_Form {...form}>
      <form
        id={id + "-contact-form"}
        className={cn("flex w-full flex-col gap-4", className)}
        {...props}
        onSubmit={handleSubmit}>
        {render ? (
          render({
            controller: form.control,
            isPending,
            ReCAPTCHA: <CaptchaField control={form.control} />,
          })
        ) : (
          <>
            <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
              <FormField
                control={form.control}
                name="email"
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
              />
            </div>
            <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
              <FormField
                control={form.control}
                name="title"
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
              />
            </div>
            <div className="prose-p:m-0 mb-3 flex flex-col gap-2">
              <FormField
                control={form.control}
                name="message"
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
                    minRows={10}
                  />
                )}
              />
            </div>
            <div className="w-fit self-center rounded-2xl">
              <CaptchaField control={form.control} />
            </div>
            <SubmitForm
              id={id + "-contact-submit"}
              type="submit"
              className={cn("w-fit self-center py-2")}>
              Send
            </SubmitForm>
          </>
        )}
      </form>
    </_Form>
  );
};

const Contact: FC = () => {
  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[600px] justify-self-center",
      }}
      className="flex w-full max-w-[600px] flex-col items-center justify-start px-5 py-10 md:p-10">
      <Form />
    </Card>
  );
};

export default memo(Contact);
