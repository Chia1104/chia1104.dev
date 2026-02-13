"use client";

import { useTranslations } from "next-intl";
import { startTransition } from "react";

import { Button, Description, Label, Modal, Switch } from "@heroui/react";

import { useSettingsStore } from "@/stores/settings/store";

export const Settings = () => {
  const t = useTranslations("settings");
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);

  return (
    <Modal>
      <Button size="sm" variant="tertiary" aria-label={t("open")} isIconOnly>
        <span className="i-mdi-cog-outline size-4" aria-hidden />
      </Button>
      <Modal.Backdrop>
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              <Switch
                isSelected={aiEnabled}
                onChange={(isSelected) =>
                  startTransition(() => setAiEnabled(isSelected))
                }
                aria-label={t("aiEnabled")}>
                <div className="flex gap-3">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <div className="-mt-0.5 flex flex-col gap-1">
                    <Label className="text-sm">{t("aiEnabled")}</Label>
                    <Description>{t("aiEnabledDescription")}</Description>
                  </div>
                </div>
              </Switch>
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
