"use client";

import { useState } from "react";

import {
  Button,
  Chip,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  TextField,
  Spinner,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { agentQueryKeys } from "@chia/agent-elements/queries";
import {
  GATEWAY_KEY_ID,
  isKeyId,
  KEY_IDS,
  KEY_LABELS,
} from "@chia/ai/provider";
import type { KeyId } from "@chia/ai/provider";
import { withServiceEndpoint } from "@chia/utils/config";
import { del, get, post } from "@chia/utils/request";
import { Service } from "@chia/utils/schema";

import { PUBLIC_AGENT_KIND } from "./kind";

const aiEndpoint = (path: string) =>
  withServiceEndpoint(path, Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  });

const signKey = (provider: KeyId, apiKey: string) =>
  post<{ message: string }>(aiEndpoint("/ai/key:signed"), { apiKey, provider });

const revokeKey = (provider: KeyId) =>
  del<{ message: string }>(aiEndpoint("/ai/key"), { json: { provider } });

const fetchKeys = () => get<{ configured: KeyId[] }>(aiEndpoint("/ai/keys"));

const keysQueryKey = ["agent", "keys"] as const;

/**
 * Bring-your-own-key. Each key is encrypted into a cookie on this browser; the model list
 * refetches so the models that key unlocks stop asking for one. A gateway key opens every
 * model; a vendor key opens that vendor's, on the vendor's own API.
 */
interface ApiKeyDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApiKeyDialog = ({ isOpen, onOpenChange }: ApiKeyDialogProps) => {
  const t = useTranslations("chbot.apiKey");
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<KeyId>(GATEWAY_KEY_ID);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);

  const keys = useQuery({
    queryKey: keysQueryKey,
    queryFn: fetchKeys,
    enabled: isOpen,
  });
  const configured = new Set(keys.data?.configured ?? []);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keysQueryKey }),
      queryClient.invalidateQueries({
        queryKey: agentQueryKeys.models(PUBLIC_AGENT_KIND),
      }),
    ]);

  const save = useMutation({
    mutationFn: ({ provider: id, key }: { provider: KeyId; key: string }) =>
      signKey(id, key),
    onSuccess: async () => {
      setApiKey("");
      setShowKey(false);
      toast.success(t("saved"));
      await refresh();
    },
    onError: () => toast.error(t("failed")),
  });

  const revoke = useMutation({
    mutationFn: (id: KeyId) => revokeKey(id),
    onSuccess: async () => {
      toast.success(t("revoked"));
      await refresh();
    },
    onError: () => toast.error(t("revokeFailed")),
  });

  const busy = save.isPending || revoke.isPending;
  const selectedConfigured = configured.has(provider);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (busy) return;
        onOpenChange(open);
        if (!open) {
          setApiKey("");
          setShowKey(false);
          save.reset();
          revoke.reset();
        }
      }}>
      <Modal.Backdrop>
        <Modal.Container placement="center" scroll="inside">
          <Modal.Dialog className="gap-3 p-4 sm:max-w-[400px]">
            <Modal.CloseTrigger isDisabled={busy} />
            <Modal.Header className="pb-1">
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p className="text-muted text-sm leading-relaxed">
                {t("description")}
              </p>
              {keys.isPending ? (
                <div
                  className="text-muted flex items-center gap-2 text-sm"
                  role="status">
                  <Spinner size="sm" />
                  {t("loading")}
                </div>
              ) : keys.isError ? (
                <div className="bg-danger-soft flex items-center justify-between gap-3 rounded-xl p-3">
                  <p className="text-danger text-sm" role="alert">
                    {t("loadFailed")}
                  </p>
                  <Button
                    className="h-8 min-h-8 px-3 text-xs"
                    size="sm"
                    variant="tertiary"
                    onPress={() => void keys.refetch()}>
                    {t("retry")}
                  </Button>
                </div>
              ) : null}
              <RadioGroup
                isDisabled={busy || !keys.isSuccess}
                name="agent-api-key-provider"
                onChange={(next) => {
                  if (!isKeyId(next)) return;
                  setProvider(next);
                  setApiKey("");
                  setShowKey(false);
                  save.reset();
                  revoke.reset();
                }}
                variant="secondary"
                orientation="horizontal"
                className="grid grid-cols-3 gap-2"
                value={provider}>
                <Label className="text-muted col-span-3 mb-1 text-xs">
                  {t("provider")}
                </Label>
                {KEY_IDS.map((id) => (
                  <Radio
                    key={id}
                    value={id}
                    aria-label={KEY_LABELS[id]}
                    className="border-border data-[selected=true]:border-accent/60 data-[selected=true]:bg-accent-soft/40 min-w-0 rounded-lg border px-2 py-2">
                    <Radio.Content className="flex w-full items-center justify-center gap-1.5">
                      <Radio.Control className="size-3 shrink-0">
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="text-xs font-medium">
                        {id === GATEWAY_KEY_ID ? "Gateway" : KEY_LABELS[id]}
                      </span>
                      {keys.isSuccess && configured.has(id) ? (
                        <span
                          aria-label={t("configured")}
                          className="bg-success size-1.5 shrink-0 rounded-full"
                        />
                      ) : null}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
              <p className="text-muted -mt-1 text-xs leading-relaxed">
                {provider === GATEWAY_KEY_ID
                  ? t("gatewayHint")
                  : t("vendorHint", { provider: KEY_LABELS[provider] })}
              </p>
              <form
                id="agent-api-key-form"
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (busy || !keys.isSuccess || !apiKey.trim()) return;
                  save.mutate({ provider, key: apiKey.trim() });
                }}>
                <TextField isDisabled={busy || !keys.isSuccess}>
                  <Label htmlFor="agent-api-key">
                    {selectedConfigured ? t("replacement") : t("label")}
                  </Label>
                  <div className="relative">
                    <Input
                      autoComplete="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="h-8 min-h-8 w-full min-w-0 pr-9 font-mono text-sm"
                      id="agent-api-key"
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder={t("placeholder")}
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      variant="secondary"
                    />
                    <Button
                      type="button"
                      className="text-muted absolute top-1/2 right-0.5 size-7 min-h-7 -translate-y-1/2"
                      aria-label={showKey ? t("hide") : t("show")}
                      aria-pressed={showKey}
                      isIconOnly
                      isDisabled={busy}
                      onPress={() => setShowKey((value) => !value)}
                      variant="ghost">
                      <span
                        aria-hidden
                        className={
                          showKey
                            ? "i-mdi-eye-off-outline size-4"
                            : "i-mdi-eye-outline size-4"
                        }
                      />
                    </Button>
                  </div>
                </TextField>
                {save.isError || revoke.isError ? (
                  <p role="alert" className="text-danger text-sm">
                    {save.isError ? t("failed") : t("revokeFailed")}
                  </p>
                ) : null}
                {save.isSuccess ? (
                  <p role="status" className="text-success text-sm">
                    {t("saved")}
                  </p>
                ) : null}
              </form>
              {keys.isSuccess && selectedConfigured ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <Chip size="sm" variant="soft">
                    <Chip.Label>{t("configured")}</Chip.Label>
                  </Chip>
                  <Button
                    aria-label={t("removeProvider", {
                      provider: KEY_LABELS[provider],
                    })}
                    isDisabled={busy}
                    isPending={revoke.isPending}
                    onPress={() => revoke.mutate(provider)}
                    size="sm"
                    variant="ghost"
                    className="text-danger h-8 min-h-8 px-3 text-xs">
                    {t("revoke")}
                  </Button>
                </div>
              ) : null}
              <p className="text-muted flex gap-2 text-xs leading-relaxed">
                <span
                  aria-hidden
                  className="i-mdi-lock-outline mt-0.5 size-4 shrink-0"
                />
                {t("privacy")}
              </p>
            </Modal.Body>
            <Modal.Footer>
              <Button
                className="h-8 min-h-8 px-3 text-xs"
                slot="close"
                isDisabled={busy}
                variant="ghost"
                size="sm">
                {t("done")}
              </Button>
              <Button
                className="h-8 min-h-8 px-3 text-xs"
                form="agent-api-key-form"
                type="submit"
                size="sm"
                isDisabled={busy || !keys.isSuccess || apiKey.trim() === ""}
                isPending={save.isPending}>
                {selectedConfigured ? t("replace") : t("save")}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
