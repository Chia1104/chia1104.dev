import { bundlerImportGlslAsText } from "../../src/utils/dynamic-import-glsl-as-text";

describe("bundlerImportGlslAsText", () => {
  it("should import GLSL as text via bundler", async () => {
    const glsl = await bundlerImportGlslAsText(
      "../../src/resources/simple-noise.glsl?raw"
    );
    expect(glsl).toContain("precision mediump float;");
  });
});
