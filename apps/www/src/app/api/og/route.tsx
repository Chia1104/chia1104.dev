import { NextRequest, NextResponse, ImageResponse } from "next/server";
import { SHA_256_HASH } from "@/shared/constants";

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
        <div
          tw="bg-slate-900"
          style={{
            backgroundSize: "150px 150px",
            height: "100%",
            width: "100%",
            display: "flex",
            textAlign: "center",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            flexWrap: "nowrap",
          }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              justifyItems: "center",
              position: "relative",
            }}>
            <img
              tw="w-full"
              alt="og"
              src="https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fcyberpunk-1200-630.jpg?alt=media"
            />
            <div tw="flex flex-col absolute w-full justify-center items-center">
              <div
                style={{
                  backdropFilter: "blur(10px)",
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  color: "#fff",
                  fontSize: 60,
                  fontStyle: "normal",
                  letterSpacing: "-0.025em",
                  padding: "30px 10px 20px 20px",
                  lineHeight: 1.4,
                  whiteSpace: "pre-wrap",
                }}>
                {title}
              </div>
            </div>
            <div tw="flex flex-col justify-center items-center mr-10 absolute bottom-10">
              <div tw="text-3xl text-white">Chia1104</div>
              <div tw="text-xl text-white">https://chia1104.dev</div>
            </div>
          </div>
        </div>
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
