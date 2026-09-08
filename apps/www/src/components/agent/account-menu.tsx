"use client";

import { useRef, useState, useTransition } from "react";

import { Avatar, Button, Modal, Popover } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { agentQueryKeys } from "@chia/agent-elements/queries";
import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha/constants";
import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";

import { SiteCaptcha } from "@/components/commons/captcha";
import { useSettingsStore } from "@/stores/settings/store";

import { ApiKeyDialog } from "./api-key-dialog";
import { UsageDialog } from "./usage-dialog";

/**
 * Sign-in for a guest, sign-out for a person. Signing in links the guest's sessions and
 * spend to the account on the server (`onLinkAccount`), so nothing is lost or reset.
 */
export const AccountMenu = ({ user }: { user: Session["user"] }) => {
  const t = useTranslations("chbot.account");
  const tCheck = useTranslations("chbot.humanCheck");
  const queryClient = useQueryClient();
  const setStoredSessionId = useSettingsStore(
    (state) => state.setAgentSessionId
  );
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [panel, setPanel] = useState<"keys" | "usage" | "signIn" | null>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const openPanel = (next: "keys" | "usage" | "signIn") => {
    setMenuOpen(false);
    setPanel(next);
  };
  const closePanel = (open: boolean) => {
    if (open) return;
    setPanel(null);
    avatarRef.current?.focus();
  };

  const signIn = (provider: "github" | "google") =>
    startTransition(async () => {
      if (!captchaToken) return;
      const result = await authClient.signIn.social(
        {
          provider,
          callbackURL: `${window.location.origin}${window.location.pathname}`,
        },
        { headers: { [X_CAPTCHA_RESPONSE]: captchaToken } }
      );
      if (result.error) {
        // The token was consumed either way; a new widget mints another.
        setCaptchaToken(null);
        setAttempt((count) => count + 1);
        toast.error(tCheck("failed"));
      }
    });

  const signOut = () =>
    startTransition(async () => {
      await authClient.signOut();
      setStoredSessionId(null);
      queryClient.removeQueries({ queryKey: agentQueryKeys.all });
    });

  return (
    <>
      <Popover isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Button
          ref={avatarRef}
          aria-label={t("account")}
          isIconOnly
          size="sm"
          variant="ghost"
          className="size-8 shrink-0 rounded-full p-1">
          <Avatar className="ring-border size-6 rounded-full ring-1">
            {!user.isAnonymous && (
              <Avatar.Image alt="" src={user.image ?? undefined} />
            )}
            <Avatar.Fallback>
              {user.isAnonymous ? (
                <span aria-hidden className="i-mdi-account-outline size-4" />
              ) : (
                user.name.trim().charAt(0).toUpperCase() ||
                user.email.charAt(0).toUpperCase() ||
                "?"
              )}
            </Avatar.Fallback>
          </Avatar>
        </Button>
        <Popover.Content className="w-56 p-1">
          <Popover.Dialog className="p-0">
            <Popover.Arrow />
            <div className="border-border/60 mb-1 border-b px-2 pt-1 pb-2">
              <p className="truncate text-sm font-medium">
                {user.isAnonymous ? t("guest") : user.name}
              </p>
              <p className="text-muted mt-1 truncate text-xs">
                {user.isAnonymous ? t("guestDescription") : user.email}
              </p>
            </div>
            <Button
              fullWidth
              variant="ghost"
              size="sm"
              className="h-8 min-h-8 justify-start gap-2 px-2 text-xs"
              onPress={() => openPanel("keys")}>
              <span
                aria-hidden
                className="i-mdi-key-outline text-muted size-4"
              />
              {t("apiKeys")}
              <span
                aria-hidden
                className="i-mdi-chevron-right text-muted ml-auto size-4"
              />
            </Button>
            <Button
              fullWidth
              variant="ghost"
              size="sm"
              className="h-8 min-h-8 justify-start gap-2 px-2 text-xs"
              onPress={() => openPanel("usage")}>
              <span
                aria-hidden
                className="i-mdi-chart-donut text-muted size-4"
              />
              {t("usage")}
              <span
                aria-hidden
                className="i-mdi-chevron-right text-muted ml-auto size-4"
              />
            </Button>
            <div className="border-border/60 mt-1 border-t pt-1">
              <Button
                fullWidth
                size="sm"
                className="h-8 min-h-8 justify-start gap-2 px-2 text-xs"
                isPending={isPending}
                onPress={user.isAnonymous ? () => openPanel("signIn") : signOut}
                variant="ghost">
                <span
                  aria-hidden
                  className={
                    user.isAnonymous
                      ? "i-mdi-login text-muted size-4"
                      : "i-mdi-logout text-muted size-4"
                  }
                />
                {user.isAnonymous ? t("signIn") : t("signOut")}
              </Button>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
      {panel === "keys" && <ApiKeyDialog isOpen onOpenChange={closePanel} />}
      {panel === "usage" && <UsageDialog isOpen onOpenChange={closePanel} />}
      <Modal isOpen={panel === "signIn"} onOpenChange={closePanel}>
        <Modal.Backdrop>
          <Modal.Container placement="center">
            <Modal.Dialog className="gap-3 p-4 sm:max-w-[380px]">
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t("signInTitle")}</Modal.Heading>
              </Modal.Header>
              <Modal.Body className="flex flex-col gap-3">
                <p className="text-muted text-sm">{t("signInDescription")}</p>
                <SiteCaptcha
                  key={attempt}
                  className="self-center"
                  onToken={setCaptchaToken}
                />
                <Button
                  fullWidth
                  isDisabled={!captchaToken}
                  isPending={isPending}
                  onPress={() => signIn("github")}
                  size="sm"
                  className="h-8 min-h-8 px-3 text-xs"
                  variant="outline">
                  <svg
                    aria-hidden
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  {t("github")}
                </Button>
                <Button
                  fullWidth
                  isDisabled={!captchaToken}
                  isPending={isPending}
                  onPress={() => signIn("google")}
                  size="sm"
                  className="h-8 min-h-8 px-3 text-xs"
                  variant="outline">
                  <svg
                    aria-hidden
                    height="1em"
                    viewBox="0 0 256 262"
                    width="1em"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
                      fill="#4285F4"
                    />
                    <path
                      d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
                      fill="#34A853"
                    />
                    <path
                      d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
                      fill="#EB4335"
                    />
                  </svg>
                  {t("google")}
                </Button>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};
