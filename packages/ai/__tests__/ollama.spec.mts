import { isOllamaEnabled } from "../src/ollama/utils";

describe("test ollama", () => {
  it("test ollama", async () => {
    const isEnabled = await isOllamaEnabled();
    console.log(isEnabled);
  });
});
