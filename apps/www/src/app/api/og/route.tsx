import { NextRequest, NextResponse, ImageResponse } from "next/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const hasTitle = searchParams.has("title");
    const title = hasTitle
      ? searchParams.get("title")?.slice(0, 100)
      : "Full Stack Engineer";
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
            <div tw="flex flex-col absolute w-full justify-center items-center p-20">
              <div
                style={{
                  color: "#fff",
                  fontSize: 60,
                  fontStyle: "normal",
                  letterSpacing: "-0.025em",
                  padding: "0 120px",
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
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
