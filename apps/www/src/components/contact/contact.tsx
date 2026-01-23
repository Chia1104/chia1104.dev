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
import { useLocale, useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { Control } from "react-hook-form";
import { toast } from "sonner";

import { ErrorCode as CaptchaErrorCode } from "@chia/api/captcha";
import Card from "@chia/ui/card";
import { Form as _Form, FormField, FormItem, FormMessage } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

import { env } from "@/env";
import { HonoRPCError } from "@/libs/service/error";
import { sendEmail } from "@/services/email.service";
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
  const t = useTranslations("contact.form");
  const { mutateAsync, isPending } = useMutation({
    mutationFn: sendEmail,
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
    toast.promise(() => mutateAsync(data), {
      loading: t("loading"),
      success: () => {
        if (!disableRouterRefresh) router.refresh();
        onSuccess?.();
        return t("success");
      },
      error: (error) => {
        if (error instanceof Error) {
          onError?.(error);
        }
        if (error instanceof HonoRPCError) {
          switch (error.code) {
            case CaptchaErrorCode.CaptchaFailed:
              return t("error.captcha-validation");
            case CaptchaErrorCode.CaptchaProviderNotSupported:
              return t("error.captcha-provider");
            case CaptchaErrorCode.CaptchaRequired:
              return t("error.captcha-required");
            default:
              return t("error.send-failed");
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
                    label={t("email")}
                    placeholder={t("email-placeholder")}
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
                    label={t("title")}
                    placeholder={t("title-placeholder")}
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
                    label={t("message")}
                    name="message"
                    value={value}
                    onChange={onChange}
                    onBlur={onBlur}
                    placeholder={t("message-placeholder")}
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
              {t("send")}
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
