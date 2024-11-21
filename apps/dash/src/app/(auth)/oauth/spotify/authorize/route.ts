import { HTTPError } from "ky";
import { NextResponse } from "next/server";

import { generateAuthorizeUrl } from "@chia/api/spotify";
import type { GenerateAuthorizeUrlDTO } from "@chia/api/spotify/validator";
import { generateAuthorizeUrlSchema } from "@chia/api/spotify/validator";
import { auth } from "@chia/auth";
import { createUpstash } from "@chia/cache";
import { errorGenerator, getAdminId, handleZodError } from "@chia/utils";

import { getRedirectUri, SPOTIFY_OAUTH_STATE } from "../_utils";

export const runtime = "nodejs";

const upstash = () => createUpstash();

export const POST = auth(async (req) => {
  try {
    if (req.auth?.user.id !== getAdminId()) {
      return NextResponse.json(
        errorGenerator(403, [
          {
            field: "user",
            message: "You don't have permission to access this resource",
          },
        ]),
        {
          status: 403,
        }
      );
    }
    const dto: Partial<GenerateAuthorizeUrlDTO> = {
      // @ts-expect-error: Next.js issue - https://github.com/vercel/next.js/issues/59823
      redirectUri: getRedirectUri(req),
    };
    await req
      .json()
      .then((data) => {
        Object.assign(dto, data);
      })
      .catch(() => {
        return NextResponse.json(
          errorGenerator(400, [
            {
              field: "body",
              message: "Invalid JSON body",
            },
          ]),
          {
            status: 400,
          }
        );
      });
    const { isError, issues } = handleZodError({
      data: dto,
      schema: generateAuthorizeUrlSchema,
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

    await upstash().set(SPOTIFY_OAUTH_STATE, dto.state, {
      ex: 60,
    });

    const url = generateAuthorizeUrl(dto as GenerateAuthorizeUrlDTO);
    return NextResponse.json({
      url,
    });
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
});
