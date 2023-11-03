import { NextRequest, NextResponse } from "next/server";
import { ImageResponse } from "next/og";
import { SHA_256_HASH } from "@/shared/constants";
import { OpenGraph } from "@chia/ui";

export const runtime = "edge";

const key = crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(SHA_256_HASH),
  { name: "HMAC", hash: { name: "SHA-256" } },
  false,
  ["sign"]
);

const toHex = (arrayBuffer: ArrayBuffer) => {
  return Array.prototype.map
    .call(new Uint8Array(arrayBuffer), (n) => n.toString(16).padStart(2, "0"))
    .join("");
};

const font = fetch(
  new URL("../../../assets/abduction2002.ttf", import.meta.url)
).then((res) => res.arrayBuffer());

export async function GET(request: NextRequest) {
  try {
    const fontData = await font;
    const searchParams = request.nextUrl.searchParams;
    const hasTitle = searchParams.has("title");
    const title = hasTitle
      ? searchParams.get("title")?.slice(0, 100)
      : "Full Stack Engineer";
    const token = searchParams.get("token");
    const verifyToken = toHex(
      await crypto.subtle.sign(
        "HMAC",
        await key,
        new TextEncoder().encode(JSON.stringify({ title }))
      )
    );
    if (token !== verifyToken) {
      return new Response("Invalid token.", { status: 401 });
    }
    return new ImageResponse(
      (
        <OpenGraph
          metadata={{
            title,
          }}
        />
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Typewriter",
            data: fontData,
            style: "normal",
          },
        ],
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
