import { setSearchParams, encodeUrlEncoded } from "./url";
import { describe, expect, it } from "vitest";

describe("url test", () => {
  it("should return empty string if no params are passed", () => {
    expect(setSearchParams()).toEqual("");
  });

  it("should return empty string if foo param is undefined", () => {
    expect(setSearchParams({ foo: undefined })).toEqual("");
  });

  it("should return empty string if foo param is null", () => {
    expect(setSearchParams({ foo: null })).toEqual("");
  });

  it("should return 'foo=bar' if foo param is 'bar'", () => {
    expect(setSearchParams({ foo: "bar" })).toEqual("foo=bar");
  });

  it("should return 'foo=bar&baz=qux' if foo param is 'bar' and baz param is 'qux'", () => {
    expect(setSearchParams({ foo: "bar", baz: "qux" })).toEqual(
      "foo=bar&baz=qux"
    );
  });

  it("should be work", () => {
    expect(encodeUrlEncoded({ foo: "bar", baz: "qux" })).toEqual(
      "foo=bar&baz=qux"
    );
  })
});
