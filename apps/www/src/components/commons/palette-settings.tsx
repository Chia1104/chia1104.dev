"use client";

import { useMemo, useState } from "react";

import {
  Button,
  ColorArea,
  ColorField,
  ColorPicker,
  ColorSlider,
  ColorSwatch,
  Label,
  parseColor,
} from "@heroui/react";
import { useTranslations } from "next-intl";

import useTheme from "@chia/ui/utils/use-theme";

import { PaletteMode, PaletteToken, readThemeColor } from "@/libs/palette";
import { useSettingsStore } from "@/stores/settings/store";

const FALLBACK_COLOR = "#808080FF";

const PaletteRow = ({
  mode,
  token,
}: {
  mode: PaletteMode;
  token: PaletteToken;
}) => {
  const t = useTranslations("settings.palette");
  const custom = useSettingsStore((state) => state.palette[mode][token]);
  const setPaletteColor = useSettingsStore((state) => state.setPaletteColor);
  // The row mounts per mode (see `key` below), so the theme value is read once for that mode.
  const [themeColor] = useState(() => readThemeColor(token));
  const color = useMemo(
    () => parseColor(custom ?? themeColor ?? FALLBACK_COLOR),
    [custom, themeColor]
  );
  const label = t(`tokens.${token}.label`);

  return (
    <li className="flex items-center justify-between gap-3">
      <ColorPicker
        value={color}
        onChange={(next) =>
          setPaletteColor(mode, token, next.toString("hexa"))
        }>
        <ColorPicker.Trigger className="flex min-w-0 items-center gap-3 text-start">
          <ColorSwatch size="md" />
          <span className="flex min-w-0 flex-col">
            <Label className="text-sm">{label}</Label>
            <span className="text-muted truncate text-xs">
              {t(`tokens.${token}.description`)}
            </span>
          </span>
        </ColorPicker.Trigger>
        <ColorPicker.Popover className="max-w-62 gap-2">
          <ColorArea
            aria-label={label}
            className="max-w-full"
            colorSpace="hsb"
            xChannel="saturation"
            yChannel="brightness">
            <ColorArea.Thumb />
          </ColorArea>
          <ColorSlider channel="hue" className="gap-1 px-1" colorSpace="hsb">
            <Label>{t("hue")}</Label>
            <ColorSlider.Output className="text-muted" />
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorSlider channel="alpha" className="gap-1 px-1" colorSpace="hsb">
            <Label>{t("opacity")}</Label>
            <ColorSlider.Output className="text-muted" />
            <ColorSlider.Track>
              <ColorSlider.Thumb />
            </ColorSlider.Track>
          </ColorSlider>
          <ColorField aria-label={t("hex")}>
            <ColorField.Group variant="secondary">
              <ColorField.Prefix>
                <ColorSwatch size="xs" />
              </ColorField.Prefix>
              <ColorField.Input />
            </ColorField.Group>
          </ColorField>
        </ColorPicker.Popover>
      </ColorPicker>
      {custom ? (
        <Button
          aria-label={t("reset", { name: label })}
          isIconOnly
          onPress={() => setPaletteColor(mode, token, null)}
          size="sm"
          variant="ghost">
          <span aria-hidden className="i-lucide-rotate-ccw size-4" />
        </Button>
      ) : null}
    </li>
  );
};

/** Recolours the theme for the mode on screen; each mode keeps its own overrides. */
export const PaletteSettings = () => {
  const t = useTranslations("settings.palette");
  const { isDarkMode } = useTheme();
  const mode = isDarkMode ? PaletteMode.Dark : PaletteMode.Light;
  const isCustomised = useSettingsStore(
    (state) => Object.keys(state.palette[mode]).length > 0
  );
  const resetPalette = useSettingsStore((state) => state.resetPalette);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="palette-title">
      <header className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 id="palette-title" className="text-sm font-medium">
            {t("title")}
          </h3>
          <p className="text-muted text-xs">
            {t(mode === PaletteMode.Dark ? "editing-dark" : "editing-light")}
          </p>
        </div>
        <Button
          isDisabled={!isCustomised}
          onPress={() => resetPalette(mode)}
          size="sm"
          variant="ghost">
          {t("reset-all")}
        </Button>
      </header>
      <ul key={mode} className="flex flex-col gap-3">
        {Object.values(PaletteToken).map((token) => (
          <PaletteRow key={token} mode={mode} token={token} />
        ))}
      </ul>
    </section>
  );
};
