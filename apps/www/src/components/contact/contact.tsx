"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, memo } from "react";

import {
  Input,
  TextArea,
  FieldError,
  TextField,
  Label,
  Form as FormRoot,
} from "@heroui/react";
import type { FormProps } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ErrorCode as CaptchaErrorCode } from "@chia/api/captcha";
import meta from "@chia/meta";
import Card from "@chia/ui/card";
import SubmitForm from "@chia/ui/submit-form";
import { cn } from "@chia/ui/utils/cn.util";
import useTheme from "@chia/ui/utils/use-theme";

import { env } from "@/env";
import { HonoRPCError } from "@/libs/service/error";
import { sendEmail } from "@/services/email.service";
import type { Contact } from "@/shared/validator";
import { contactSchema } from "@/shared/validator";

const ReCAPTCHA = dynamic(() => import("react-google-recaptcha"), {
  ssr: false,
});
const Turnstile = dynamic(() =>
  import("@marsidev/react-turnstile").then((mod) => mod.Turnstile)
);

export const ContactForm = ({
  className,
  onSuccess,
  onError,
  disableRouterRefresh = false,
  ...props
}: FormProps & {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  disableRouterRefresh?: boolean;
}) => {
  const id = useId();
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const locale = useLocale();
  const t = useTranslations("contact.form");
  const tContact = useTranslations("contact");

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
    <FormRoot
      id={id + "-contact-form"}
      className={cn("flex w-full flex-col gap-6", className)}
      {...props}
      onSubmit={handleSubmit}>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <TextField isInvalid={fieldState.invalid}>
            <Label htmlFor={field.name}>
              {t("email")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              {...field}
              id={field.name}
              type="email"
              placeholder={t("email-placeholder")}
              aria-invalid={fieldState.invalid}
              autoComplete="email"
              data-testid="contact-email"
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <TextField isInvalid={fieldState.invalid}>
            <Label htmlFor={field.name}>
              {t("title")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <Input
              {...field}
              id={field.name}
              type="text"
              placeholder={t("title-placeholder")}
              aria-invalid={fieldState.invalid}
              autoComplete="off"
              data-testid="contact-title"
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )}
      />
      <Controller
        control={form.control}
        name="message"
        render={({ field, fieldState }) => (
          <TextField isInvalid={fieldState.invalid}>
            <Label htmlFor={field.name}>
              {t("message")}
              <span className="text-destructive ml-0.5">*</span>
            </Label>
            <TextArea
              {...field}
              id={field.name}
              placeholder={t("message-placeholder")}
              aria-invalid={fieldState.invalid}
              rows={10}
              className="min-h-[200px] resize-none"
              data-testid="contact-message"
            />
            <FieldError>{fieldState.error?.message}</FieldError>
          </TextField>
        )}
      />
      <div className="w-fit self-center rounded-2xl">
        <Controller
          control={form.control}
          name="captchaToken"
          render={({ field, fieldState }) => (
            <TextField isInvalid={fieldState.invalid}>
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
              <FieldError>{fieldState.error?.message}</FieldError>
            </TextField>
          )}
        />
      </div>
      <div className="flex flex-col items-center gap-2">
        <SubmitForm
          isPending={isPending}
          id={id + "-contact-submit"}
          type="submit"
          className={cn("w-fit self-center py-2")}
          data-testid="contact-submit">
          {t("send")}
        </SubmitForm>
        <span className="flex gap-1">
          {tContact("or-via")}
          <Link href={`mailto:${meta.email}`} className="flex w-fit">
            {t("email")}
          </Link>
        </span>
      </div>
    </FormRoot>
  );
};

const Contact = () => {
  return (
    <Card
      wrapperProps={{
        className: "w-full max-w-[600px] justify-self-center",
      }}
      className="flex w-full max-w-[600px] flex-col items-center justify-start px-5 py-10 md:p-10">
      <ContactForm />
    </Card>
  );
};

export default memo(Contact);
