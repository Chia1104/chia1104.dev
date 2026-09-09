"use client";

import { useRef, useState, useTransition } from "react";

import { Avatar, Button, Modal, Popover } from "@heroui/react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { agentQueryKeys } from "@chia/agent-elements/queries";
import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";

import { useSettingsStore } from "@/stores/settings/store";

import { ApiKeyDialog } from "./api-key-dialog";
import { SignInProviders } from "./sign-in-providers";
import { UsageDialog } from "./usage-dialog";

/** Sign-in for a guest, sign-out for a person. */
export const AccountMenu = ({ user }: { user: Session["user"] }) => {
  const t = useTranslations("chbot.account");
  const queryClient = useQueryClient();
  const setStoredSessionId = useSettingsStore(
    (state) => state.setAgentSessionId
  );
  const [isPending, startTransition] = useTransition();
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
              className="justify-start gap-2 px-2"
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
              className="justify-start gap-2 px-2"
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
                className="justify-start gap-2 px-2"
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
                <SignInProviders className="flex flex-col gap-3" />
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
};
