import { compileMDX } from "../src/core";

describe("compileMDX", () => {
  it("should compile mdx", async () => {
    const content = `
    # Hello

    - spec 1

    [ ] todo 1

    > Hello
    `;
    const result = await compileMDX(content);
    expect(result).toMatchSnapshot();
  });
});
