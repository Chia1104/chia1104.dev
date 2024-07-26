import { HTTPError } from "ky";
import { unstable_noStore as noStore } from "next/cache";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { codeAuthorization } from "@chia/api/spotify";
import type { CodeAuthorizationDTO } from "@chia/api/spotify/validator";
import { codeAuthorizationSchema } from "@chia/api/spotify/validator";
import { createUpstash } from "@chia/cache/src/create-upstash";
import { errorGenerator, handleZodError } from "@chia/utils";

import {
  getRedirectUri,
  SPOTIFY_OAUTH_STATE,
  SPOTIFY_OAUTH_RESULT,
  getSiteUrl,
} from "../_utils";

export const runtime = "edge";

const upstash = () => createUpstash();

export const GET = async (req: NextRequest) => {
  noStore();
  try {
    const storedState = await upstash().get<string>(SPOTIFY_OAUTH_STATE);
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
    await upstash().set(SPOTIFY_OAUTH_RESULT, result);
    return NextResponse.redirect(
      `${getSiteUrl(req)}/oauth/spotify/callback/success`
    );
  } catch (error) {
    console.error(error);
    if (error instanceof HTTPError) {
      return NextResponse.json(
        errorGenerator(error.response.status, [
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
