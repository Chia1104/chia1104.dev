"use client";

import { startTransition } from "react";

import { Button, Description, Label, Modal, Switch } from "@heroui/react";
import { useTranslations } from "next-intl";

import { useSettingsStore } from "@/stores/settings/store";

export const Settings = () => {
  const t = useTranslations("settings");
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);
  const backgroundEnabled = useSettingsStore((s) => s.backgroundEnabled);
  const setBackgroundEnabled = useSettingsStore((s) => s.setBackgroundEnabled);
  const cursorEnabled = useSettingsStore((s) => s.cursorEnabled);
  const setCursorEnabled = useSettingsStore((s) => s.setCursorEnabled);

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
              <Switch
                isSelected={backgroundEnabled}
                onChange={(isSelected) =>
                  startTransition(() => setBackgroundEnabled(isSelected))
                }
                aria-label={t("backgroundEnabled")}>
                <div className="flex gap-3">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <div className="-mt-0.5 flex flex-col gap-1">
                    <Label className="text-sm">{t("backgroundEnabled")}</Label>
                    <Description>
                      {t("backgroundEnabledDescription")}
                    </Description>
                  </div>
                </div>
              </Switch>
              <Switch
                isSelected={cursorEnabled}
                onChange={(isSelected) =>
                  startTransition(() => setCursorEnabled(isSelected))
                }
                aria-label={t("cursorEnabled")}>
                <div className="flex gap-3">
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                  <div className="-mt-0.5 flex flex-col gap-1">
                    <Label className="text-sm">{t("cursorEnabled")}</Label>
                    <Description>{t("cursorEnabledDescription")}</Description>
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
