import { NextRequest } from "next/server";
import { test } from "vitest";

import { generate } from "./generate";

test("generate", async () => {
  const req = new NextRequest("http://localhost", {
    method: "POST",
    body: new URLSearchParams({
      prompt: "This is a test prompt.",
    }),
  });
  const res = await generate(req, {});
  console.log(res);
});
