"use client";

import { startTransition } from "react";
import type { ReactNode } from "react";

import { Button, Description, Label, Modal, Switch } from "@heroui/react";
import { useTranslations } from "next-intl";

import { PaletteSettings } from "@/components/commons/palette-settings";
import { useReducedEffects } from "@/hooks/use-reduced-effects";
import { SiteMode } from "@/shared/site-mode";
import { useSettingsStore } from "@/stores/settings/store";

const Toggle = ({
  label,
  description,
  isSelected,
  onChange,
}: {
  label: string;
  description: ReactNode;
  isSelected: boolean;
  onChange: (isSelected: boolean) => void;
}) => (
  <Switch
    size="sm"
    isSelected={isSelected}
    onChange={(next) => startTransition(() => onChange(next))}
    aria-label={label}>
    <Switch.Content>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      <div className="-mt-0.5 flex flex-col gap-1">
        <Label className="text-sm">{label}</Label>
        <Description>{description}</Description>
      </div>
    </Switch.Content>
  </Switch>
);

const TechSettings = () => {
  const t = useTranslations("settings");
  const aiEnabled = useSettingsStore((s) => s.aiEnabled);
  const setAiEnabled = useSettingsStore((s) => s.setAiEnabled);
  return (
    <>
      <Toggle
        label={t("aiEnabled")}
        description={t("aiEnabledDescription")}
        isSelected={aiEnabled}
        onChange={setAiEnabled}
      />
      <div className="border-separator border-t pt-4">
        <PaletteSettings />
      </div>
    </>
  );
};

const HobbySettings = () => {
  const t = useTranslations("settings");
  const reducedEffects = useReducedEffects();
  const setReducedEffects = useSettingsStore((s) => s.setReducedEffects);
  return (
    <Toggle
      label={t("reducedEffects")}
      description={t("reducedEffectsDescription")}
      isSelected={reducedEffects}
      onChange={setReducedEffects}
    />
  );
};

/**
 * Each mode lists what applies to it: the agent and the reader palette exist only in the tech
 * mode, the effects only in the hobby mode.
 */
export const Settings = ({ mode }: { mode: SiteMode }) => {
  const t = useTranslations("settings");

  return (
    <Modal>
      <Button size="sm" variant="tertiary" aria-label={t("open")} isIconOnly>
        <span className="i-mdi-cog-outline size-4" aria-hidden />
      </Button>
      {/* The page stays visible so a change can be judged against it. */}
      <Modal.Backdrop variant="transparent">
        <Modal.Container placement="center">
          <Modal.Dialog className="sm:max-w-[400px]">
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t("title")}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-4">
              {mode === SiteMode.Tech ? <TechSettings /> : <HobbySettings />}
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
};
