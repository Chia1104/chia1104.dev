import { afterEach, describe, expect, it } from "vitest";

import {
  PALETTE_STYLE_ID,
  PaletteToken,
  getPaletteScript,
  writePaletteStyle,
} from "@/libs/palette";

const TOKENS = Object.values(PaletteToken);
const STORAGE_KEY = "TEST_SETTINGS";

const styleText = () =>
  document.getElementById(PALETTE_STYLE_ID)?.textContent ?? null;

afterEach(() => {
  document.getElementById(PALETTE_STYLE_ID)?.remove();
  localStorage.clear();
});

describe("writePaletteStyle", () => {
  it("scopes each mode to the class next-themes sets on <html>", () => {
    writePaletteStyle(
      { light: { accent: "#FF000080" }, dark: { separator: "#00FF00FF" } },
      PALETTE_STYLE_ID,
      TOKENS
    );
    expect(styleText()).toBe(
      ":root:not(.dark){--accent:#FF000080;}:root.dark{--separator:#00FF00FF;}"
    );
  });

  it("reuses one style element and empties it once nothing is customised", () => {
    writePaletteStyle(
      { light: { accent: "#FF000080" } },
      PALETTE_STYLE_ID,
      TOKENS
    );
    writePaletteStyle(null, PALETTE_STYLE_ID, TOKENS);
    expect(document.querySelectorAll(`#${PALETTE_STYLE_ID}`)).toHaveLength(1);
    expect(styleText()).toBe("");
  });
});

describe("getPaletteScript", () => {
  it("applies the persisted palette on its own", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: { palette: { dark: { accent: "#0000FFFF" } } },
        version: 1,
      })
    );
    new Function(getPaletteScript(STORAGE_KEY))();
    expect(styleText()).toBe(":root.dark{--accent:#0000FFFF;}");
  });

  it("drops stored values that are not #RRGGBBAA and tokens outside the list", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        state: {
          palette: {
            light: {
              accent: "red;} body{display:none",
              background: "#fff",
              foreground: 42,
              radius: "#FF000080",
              muted: "#12345678",
            },
          },
        },
      })
    );
    new Function(getPaletteScript(STORAGE_KEY))();
    expect(styleText()).toBe(":root:not(.dark){--muted:#12345678;}");
  });

  it("cannot close its <script> element through the storage key", () => {
    const key = "</script><script>alert(1)</script>";
    const script = getPaletteScript(key);
    expect(script).not.toContain("</script>");
    localStorage.setItem(
      key,
      JSON.stringify({ state: { palette: { dark: { muted: "#12345678" } } } })
    );
    new Function(script)();
    expect(styleText()).toBe(":root.dark{--muted:#12345678;}");
  });

  it("does nothing when storage is empty or unreadable", () => {
    new Function(getPaletteScript(STORAGE_KEY))();
    localStorage.setItem(STORAGE_KEY, "{not json");
    new Function(getPaletteScript(STORAGE_KEY))();
    expect(styleText()).toBe("");
  });
});
