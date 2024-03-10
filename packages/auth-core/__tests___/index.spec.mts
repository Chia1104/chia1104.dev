import { name } from "../src";

describe("auth-core test", () => {
  it("should return auth-core", () => {
    expect(name).toEqual("auth-core");
  });
});
