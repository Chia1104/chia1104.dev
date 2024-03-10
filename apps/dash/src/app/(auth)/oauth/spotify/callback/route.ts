import { errorGenerator, handleZodError } from "@chia/utils";
import {
  CodeAuthorizationDTO,
  codeAuthorizationSchema,
} from "@chia/api/spotify/validator";
import { codeAuthorization } from "@chia/api/spotify";
import { NextResponse, NextRequest } from "next/server";
import {
  getRedirectUri,
  SPOTIFY_OAUTH_STATE,
  SPOTIFY_OAUTH_RESULT,
  getSiteUrl,
} from "../_utils";
import { HTTPError } from "ky";
import { unstable_noStore as noStore } from "next/cache";
import { createUpstash } from "@chia/cache/src/create-upstash";

export const runtime = "edge";

export const GET = async (req: NextRequest) => {
  noStore();
  try {
    const upstash = createUpstash();
    const storedState = await upstash.get<string>(SPOTIFY_OAUTH_STATE);
    const searchParams = req.nextUrl.searchParams;
    const dto = {
      code: searchParams.get("code") ?? "",
      state: searchParams.get("state") ?? "",
      redirectUri: getRedirectUri(req),
    };
    const { isError, issues } = handleZodError({
      data: dto,
      schema: codeAuthorizationSchema.refine(
        (data) => {
          if (!storedState) {
            return false;
          }
          return data.state === storedState;
        },
        {
          message: "Invalid state",
          path: ["state"],
        }
      ),
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

    const result = await codeAuthorization(dto as CodeAuthorizationDTO);
    await upstash.set(SPOTIFY_OAUTH_RESULT, result);
    return NextResponse.redirect(
      `${getSiteUrl(req)}/oauth/spotify/callback/success`
    );
  } catch (error) {
    console.error(error);
    if (error instanceof HTTPError) {
      return NextResponse.json(
        errorGenerator(error.response.status as any, [
          {
            field: "spotify",
            message: error.message,
          },
        ]),
        {
          status: error.response.status,
        }
      );
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
};
