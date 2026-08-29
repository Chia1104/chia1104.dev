import { nodePgCodecs } from "drizzle-orm/node-postgres";
import { describe, expect, it } from "vitest";

import {
  storableCodecs,
  toStorableJson,
  toStorableString,
} from "../src/storable.ts";

describe("toStorableString", () => {
  it("drops NUL and replaces lone surrogates, leaving pairs intact", () => {
    expect(toStorableString("a\0b")).toBe("ab");
    expect(toStorableString("x\uD83Dy")).toBe("x�y");
    expect(toStorableString("x\uDE00y")).toBe("x�y");
    expect(toStorableString("😀 中文 \\u0000")).toBe("😀 中文 \\u0000");
  });

  it("returns clean strings unchanged", () => {
    const clean = "參考：[note]";
    expect(toStorableString(clean)).toBe(clean);
  });
});

describe("toStorableJson", () => {
  it("scrubs nested strings and keys and keeps every other value", () => {
    expect(
      toStorableJson({
        "k\0ey": ["a\0", { n: 1, s: "\uD83D", b: null }],
        ok: true,
      })
    ).toEqual({
      key: ["a", { n: 1, s: "�", b: null }],
      ok: true,
    });
  });
});

describe("storableCodecs", () => {
  it("scrubs text parameters, singly and as arrays", () => {
    expect(storableCodecs.text?.normalizeParam?.("a\0b")).toBe("ab");
    expect(storableCodecs.varchar?.normalizeParam?.(7)).toBe(7);
    expect(
      storableCodecs.text?.normalizeParamArray?.(["a\0", ["\uD83D"]], 2)
    ).toEqual(["a", ["�"]]);
  });

  it("scrubs JSON parameters before the driver serialises them", () => {
    expect(storableCodecs.jsonb?.normalizeParam?.({ text: "a\0b" })).toEqual({
      text: "ab",
    });
    // Arrays are pre-serialised so the driver does not mistake them for a Postgres array.
    expect(storableCodecs.jsonb?.normalizeParam?.(["a\0"])).toBe(
      nodePgCodecs.jsonb?.normalizeParam?.(["a"])
    );
  });

  it("keeps every other codec", () => {
    expect(storableCodecs.timestamp).toBe(nodePgCodecs.timestamp);
  });
});
