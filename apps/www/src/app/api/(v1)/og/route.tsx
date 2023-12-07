import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { env } from "@/env.mjs";
import { OpenGraph } from "@chia/ui";
import { errorGenerator, handleZodError } from "@chia/utils";
import { ogSchema, type OgDTO } from "./utils";

export const runtime = "edge";

const key = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(env.SHA_256_HASH),
  { name: "HMAC", hash: { name: "SHA-256" } },
  false,
  ["sign"]
);

const toHex = (arrayBuffer: ArrayBuffer) => {
  return Array.prototype.map
    .call(new Uint8Array(arrayBuffer), (n) => n.toString(16).padStart(2, "0"))
    .join("");
};

const isUrl = (url: string) => {
  try {
    const _url = new URL(url);
    return _url.protocol === "http:" || _url.protocol === "https:";
  } catch (e) {
    return false;
  }
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hasTitle = searchParams.has("title");

    const title = hasTitle
      ? searchParams.get("title")?.slice(0, 100)
      : "Full Stack Engineer";
    const excerpt = searchParams.get("excerpt");
    const subtitle = searchParams.get("subtitle");
    const token = searchParams.get("token");

    const verifyToken = toHex(
      await crypto.subtle.sign(
        "HMAC",
        await key,
        new TextEncoder().encode(JSON.stringify({ title }))
      )
    );

    const { isError, issues } = handleZodError({
      schema: ogSchema(verifyToken),
      data: {
        title,
        excerpt,
        subtitle,
        token,
      },
    });

    if (isError) {
      return NextResponse.json(
        errorGenerator(
          400,
          issues?.map((issue) => {
            return {
              field: issue.path.join("."),
              message: issue.message,
            };
          })
        ),
        { status: 400 }
      );
    }
    return new ImageResponse(
      (
        <OpenGraph
          metadata={{
            title,
            excerpt,
            subtitle,
          }}
          styles={{
            title: {
              color: "transparent",
            },
          }}
        />
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return NextResponse.json(errorGenerator(500), { status: 500 });
  }
}
