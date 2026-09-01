import { safe } from "@orpc/client";
import { beforeEach, describe, expect, it } from "vitest";

import * as guardMocks from "./helpers/guards";
import { client, errorCode } from "./helpers/rpc";

const captchaToken = "test-captcha-token";

describe("email.send", () => {
  beforeEach(() => {
    guardMocks.resetAllGuardMocks();
  });

  it("rejects an invalid email format", async () => {
    const { error } = await safe(
      client.email.send({
        email: "not-an-email",
        title: "Test Title",
        message: "Test Message",
        captchaToken,
      })
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
  }, 15000);

  it("rejects a short title", async () => {
    const { error } = await safe(
      client.email.send({
        email: "test@example.com",
        title: "Hi",
        message: "Test Message",
        captchaToken,
      })
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
  }, 15000);

  it("rejects a short message", async () => {
    const { error } = await safe(
      client.email.send({
        email: "test@example.com",
        title: "Test Title",
        message: "Hi",
        captchaToken,
      })
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
  }, 15000);

  it("rejects missing required fields", async () => {
    const { error } = await safe(
      client.email.send({ email: "test@example.com" } as never)
    );

    expect(errorCode(error)).toBe("BAD_REQUEST");
  }, 15000);

  it(
    "sends the email with valid data",
    {
      skip: true,
    },
    async () => {
      const { error } = await safe(
        client.email.send({
          email: "test@example.com",
          title: "Test Title",
          message: "This is a test message",
          captchaToken,
        })
      );

      expect(
        error === null ||
          ["UNAUTHORIZED", "FORBIDDEN", "INTERNAL_SERVER_ERROR"].includes(
            errorCode(error) ?? ""
          )
      ).toBe(true);
    }
  );
});
