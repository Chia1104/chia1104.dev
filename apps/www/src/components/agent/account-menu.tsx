"use client";

import { useState, useTransition } from "react";

import { Avatar, Button, Popover } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { agentQueryKeys } from "@chia/agent-elements/queries";
import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha/constants";
import { authClient } from "@chia/auth/client";

import { SiteCaptcha } from "@/components/commons/captcha";
import { useSettingsStore } from "@/stores/settings/store";

import { chatSessionQueryKey } from "./use-chat-session";
import type { ChatUser } from "./use-chat-session";

/** `?chat` reopens the drawer once the provider sends the visitor back. */
const callbackURL = () =>
  `${window.location.origin}${window.location.pathname}?chat`;

/**
 * Sign-in for a guest, sign-out for a person. Signing in links the guest's sessions and
 * spend to the account on the server (`onLinkAccount`), so nothing is lost or reset.
 */
export const AccountMenu = ({ user }: { user: ChatUser }) => {
  const t = useTranslations("chbot.account");
  const tCheck = useTranslations("chbot.humanCheck");
  const queryClient = useQueryClient();
  const setStoredSessionId = useSettingsStore(
    (state) => state.setAgentSessionId
  );
  const [isPending, startTransition] = useTransition();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const signIn = (provider: "github" | "google") =>
    startTransition(async () => {
      if (!captchaToken) return;
      const result = await authClient.signIn.social(
        { provider, callbackURL: callbackURL() },
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
      // Cleared, not refetched in place: the panel returns to the human check for a new guest.
      await queryClient.resetQueries({ queryKey: chatSessionQueryKey });
    });

  if (user.isAnonymous) {
    return (
      <Popover>
        <Button size="sm" variant="tertiary">
          <span aria-hidden className="i-mdi-login size-4" />
          {t("signIn")}
        </Button>
        <Popover.Content className="max-w-[22rem]">
          <Popover.Dialog>
            <Popover.Arrow />
            <Popover.Heading>{t("signInTitle")}</Popover.Heading>
            <p className="text-muted mt-1 text-sm">{t("signInDescription")}</p>
            <div className="mt-3 flex flex-col items-stretch gap-2">
              <SiteCaptcha
                key={attempt}
                className="self-center"
                onToken={setCaptchaToken}
              />
              <Button
                isDisabled={!captchaToken}
                isPending={isPending}
                onPress={() => signIn("github")}
                size="sm"
                variant="secondary">
                <span aria-hidden className="i-mdi-github size-4" />
                {t("github")}
              </Button>
              <Button
                isDisabled={!captchaToken}
                isPending={isPending}
                onPress={() => signIn("google")}
                size="sm"
                variant="secondary">
                <span aria-hidden className="i-mdi-google size-4" />
                {t("google")}
              </Button>
            </div>
          </Popover.Dialog>
        </Popover.Content>
      </Popover>
    );
  }

  return (
    <Popover>
      <Button
        aria-label={t("account")}
        className="rounded-full"
        isIconOnly
        size="sm"
        variant="tertiary">
        <Avatar className="size-6">
          <Avatar.Image alt="" src={user.image ?? undefined} />
          <Avatar.Fallback>{user.name.charAt(0).toUpperCase()}</Avatar.Fallback>
        </Avatar>
      </Button>
      <Popover.Content className="max-w-72">
        <Popover.Dialog>
          <Popover.Arrow />
          <p className="truncate font-medium">{user.name}</p>
          <p className="text-muted truncate text-xs">{user.email}</p>
          <Button
            className="mt-3"
            isPending={isPending}
            onPress={signOut}
            size="sm"
            variant="secondary">
            <span aria-hidden className="i-mdi-logout size-4" />
            {t("signOut")}
          </Button>
        </Popover.Dialog>
      </Popover.Content>
    </Popover>
  );
};
