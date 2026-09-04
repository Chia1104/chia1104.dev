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
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
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
import { Service } from "@chia/utils/schema";

import { PUBLIC_AGENT_KIND } from "./kind";

const aiEndpoint = (path: string) =>
  withServiceEndpoint(path, Service.LegacyService, {
    isInternal: false,
    version: "LEGACY",
  });

const signKey = (provider: KeyId, apiKey: string) =>
  ky
    .post(aiEndpoint("/ai/key:signed"), {
      json: { apiKey, provider },
      credentials: "include",
    })
    .json<{ message: string }>();

const revokeKey = (provider: KeyId) =>
  ky
    .delete(aiEndpoint("/ai/key"), {
      json: { provider },
      credentials: "include",
    })
    .json<{ message: string }>();

const fetchKeys = () =>
  ky
    .get(aiEndpoint("/ai/keys"), { credentials: "include" })
    .json<{ configured: KeyId[] }>();

const keysQueryKey = ["agent", "keys"] as const;

/**
 * Bring-your-own-key. Each key is encrypted into a cookie on this browser; the model list
 * refetches so the models that key unlocks stop asking for one. A gateway key opens every
 * model; a vendor key opens that vendor's, on the vendor's own API.
 */
export const ApiKeyDialog = () => {
  const t = useTranslations("chbot.apiKey");
  const queryClient = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const [provider, setProvider] = useState<KeyId>(GATEWAY_KEY_ID);
  const [apiKey, setApiKey] = useState("");

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
    mutationFn: () => signKey(provider, apiKey.trim()),
    onSuccess: async () => {
      setApiKey("");
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

  return (
    <Modal isOpen={isOpen} onOpenChange={setOpen}>
      <Button
        aria-label={t("open")}
        isIconOnly
        size="sm"
        variant="ghost"
        className="size-5 p-1">
        <span aria-hidden className="i-mdi-key-outline size-3" />
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <p className="text-muted text-sm">{t("description")}</p>
              <RadioGroup
                name="agent-api-key-provider"
                onChange={(next) => {
                  if (isKeyId(next)) setProvider(next);
                }}
                variant="secondary"
                value={provider}>
                <Label>{t("provider")}</Label>
                {KEY_IDS.map((id) => (
                  <Radio key={id} value={id}>
                    <Radio.Content className="flex w-full items-center gap-2">
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="flex-1 text-sm">{KEY_LABELS[id]}</span>
                      {configured.has(id) ? (
                        <>
                          <Chip size="sm" variant="soft">
                            <Chip.Label className="text-xs">
                              {t("configured")}
                            </Chip.Label>
                          </Chip>
                          <Button
                            aria-label={t("revoke")}
                            isPending={
                              revoke.isPending && revoke.variables === id
                            }
                            onPress={() => revoke.mutate(id)}
                            size="sm"
                            variant="ghost">
                            {t("revoke")}
                          </Button>
                        </>
                      ) : null}
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
              <TextField>
                <Label htmlFor="agent-api-key">{t("label")}</Label>
                <Input
                  autoComplete="off"
                  id="agent-api-key"
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="sk-…"
                  type="password"
                  value={apiKey}
                  variant="secondary"
                />
              </TextField>
              <Button
                isDisabled={apiKey.trim() === ""}
                isPending={save.isPending}
                onPress={() => save.mutate()}
                size="sm">
                {t("save")}
              </Button>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
