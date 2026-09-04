"use client";

import { useState } from "react";

import {
  Button,
  Input,
  Label,
  Modal,
  Radio,
  RadioGroup,
  TextField,
} from "@heroui/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import ky from "ky";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { agentQueryKeys } from "@chia/agent-elements/queries";
import {
  isProviderId,
  PROVIDER_IDS,
  PROVIDER_LABELS,
  ProviderId,
} from "@chia/ai/provider";
import { withServiceEndpoint } from "@chia/utils/config";
import { Service } from "@chia/utils/schema";

import { PUBLIC_AGENT_KIND } from "./kind";

const signKey = (provider: ProviderId, apiKey: string) =>
  ky
    .post(
      withServiceEndpoint("/ai/key:signed", Service.LegacyService, {
        isInternal: false,
        version: "LEGACY",
      }),
      { json: { apiKey, provider }, credentials: "include" }
    )
    .json<{ message: string }>();

/**
 * Bring-your-own-key. The key is encrypted into a provider cookie on this browser; the
 * model list refetches so that provider's models stop asking for a key.
 */
export const ApiKeyDialog = () => {
  const t = useTranslations("chbot.apiKey");
  const queryClient = useQueryClient();
  const [isOpen, setOpen] = useState(false);
  const [provider, setProvider] = useState<ProviderId>(ProviderId.OpenAI);
  const [apiKey, setApiKey] = useState("");

  const save = useMutation({
    mutationFn: () => signKey(provider, apiKey.trim()),
    onSuccess: async () => {
      setApiKey("");
      setOpen(false);
      toast.success(t("saved"));
      await queryClient.invalidateQueries({
        queryKey: agentQueryKeys.models(PUBLIC_AGENT_KIND),
      });
    },
    onError: () => toast.error(t("failed")),
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
                  if (isProviderId(next)) setProvider(next);
                }}
                variant="secondary"
                orientation="horizontal"
                value={provider}>
                <Label>{t("provider")}</Label>
                {PROVIDER_IDS.map((id) => (
                  <Radio key={id} value={id}>
                    <Radio.Content>
                      <Radio.Control>
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="text-sm">{PROVIDER_LABELS[id]}</span>
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
