/** The theme tokens a reader may recolour; each value is the CSS variable name without `--`. */
export const PaletteToken = {
  Accent: "accent",
  Background: "background",
  Foreground: "foreground",
  Surface: "surface",
  Separator: "separator",
  Muted: "muted",
} as const;

export type PaletteToken = (typeof PaletteToken)[keyof typeof PaletteToken];

/** Palette modes are the classes next-themes puts on `<html>`. */
export const PaletteMode = {
  Light: "light",
  Dark: "dark",
} as const;

export type PaletteMode = (typeof PaletteMode)[keyof typeof PaletteMode];

/** A customised colour as `#RRGGBBAA`, so opacity survives storage. */
export const HEXA_PATTERN = /^#[0-9a-f]{8}$/i;

export type ModePalette = Partial<Record<PaletteToken, string>>;

export type Palette = Record<PaletteMode, ModePalette>;

export const PALETTE_STYLE_ID = "reader-palette";

/**
 * Writes the palette into one `<style>` element. Each mode's rule keys off the `<html>` class and
 * outranks the palette file's `:root` / `.dark` rules, so the resolved mode never has to be known.
 * The pre-paint script inlines this with `toString()`, so it must not reach outside its own body.
 * That script hands over storage the reader can edit without parsing it, so every value is
 * matched against `#RRGGBBAA` here before it reaches CSS.
 */
export function writePaletteStyle(
  palette: Partial<Palette> | null,
  id: string,
  tokens: readonly PaletteToken[]
) {
  const rules = [
    ["light", ":root:not(.dark)"],
    ["dark", ":root.dark"],
  ] as const;
  let css = "";
  for (const [mode, selector] of rules) {
    const colors = palette?.[mode] ?? {};
    let declarations = "";
    for (const token of tokens) {
      const value = colors[token];
      if (value !== undefined && /^#[0-9a-f]{8}$/i.test(value)) {
        declarations += `--${token}:${value};`;
      }
    }
    if (declarations) css += `${selector}{${declarations}}`;
  }
  let style = document.getElementById(id);
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.append(style);
  }
  style.textContent = css;
}

/** Applies the stored palette before first paint; the settings store persists under `storageKey`. */
export const getPaletteScript = (storageKey: string) =>
  `(function(){try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(storageKey)})||"null");(${writePaletteStyle.toString()})(s&&s.state&&s.state.palette||null,${JSON.stringify(PALETTE_STYLE_ID)},${JSON.stringify(Object.values(PaletteToken))})}catch(e){}})()`;

/** Resolves any CSS colour, `oklch()` included, to `#RRGGBBAA` by painting one sRGB pixel. */
export const toHexa = (cssColor: string) => {
  const context = document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = cssColor;
  context.fillRect(0, 0, 1, 1);
  return `#${Array.from(context.getImageData(0, 0, 1, 1).data, (channel) =>
    channel.toString(16).padStart(2, "0")
  ).join("")}`;
};

/**
 * The theme's own value for a token in the current mode: the override sheet is switched off for
 * the one synchronous style read, so no frame is painted without it.
 */
export const readThemeColor = (token: PaletteToken) => {
  const style = document.getElementById(PALETTE_STYLE_ID);
  const sheet = style instanceof HTMLStyleElement ? style.sheet : null;
  if (sheet) sheet.disabled = true;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
  if (sheet) sheet.disabled = false;
  return value ? toHexa(value) : null;
};

/** Stops of the site gradient, derived in CSS from `--accent`; resolved here for canvas consumers. */
const ACCENT_GRADIENT_STOPS = [
  "--accent-gradient-from",
  "--accent-gradient-to",
] as const;

/**
 * The accent gradient as concrete `#RRGGBBAA` stops. Shaders cannot read CSS variables or relative
 * colours, so a hidden probe lets the browser resolve them first.
 */
export const readAccentGradient = () => {
  const probe = document.createElement("span");
  probe.style.display = "none";
  document.body.append(probe);
  const [from, to] = ACCENT_GRADIENT_STOPS.map((stop) => {
    probe.style.color = `var(${stop})`;
    return toHexa(getComputedStyle(probe).color);
  });
  probe.remove();
  return from && to ? ([from, to] as const) : null;
};
