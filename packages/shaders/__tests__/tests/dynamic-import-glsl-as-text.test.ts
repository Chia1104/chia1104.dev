import { describe, expect, it } from "vitest";
import { bundlerImportGlslAsText } from "../../src/utils/dynamic-import-glsl-as-text";

describe("bundlerImportGlslAsText", () => {
  it("imports GLSL as text via the bundler", async () => {
    const glsl = await bundlerImportGlslAsText(
      "../../src/resources/simple-noise.glsl?raw"
    );
    expect(glsl).toContain("precision mediump float;");
  });
});
