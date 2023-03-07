import sendgrid from "@sendgrid/mail";
import { Chia } from "@chia/shared/meta/chia";
import { NextResponse, NextRequest } from "next/server";
import { ApiResponseStatus } from "@chia/utils/fetcher.util";
import { errorConfig } from "@chia/config/network.config";
import { z } from "zod";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: "none noarchive noimageindex nosnippet notranslate",
};

sendgrid.setApiKey(process.env.SENDGRID_KEY ?? "");

const EmailSchema = z.string().email();

const contactSchema = z.object({
  email: EmailSchema,
  message: z.string(),
});

type Email = z.infer<typeof EmailSchema>;

export async function POST(request: NextRequest) {
  try {
    const { email, message } = (await request.json()) as {
      email: Email;
      message: string;
    };

    if (!contactSchema.safeParse({ email, message }).success) {
      return NextResponse.json(
        {
          statusCode: 400,
          status: ApiResponseStatus.ERROR,
          message: errorConfig[400],
        },
        { status: 400 }
      );
    }

    const msg = {
      to: Chia.email,
      from: Chia.email,
      subject: `Message from ${email} via chia1104.dev`,
      text: message,
    };
    const sendgridRes = await sendgrid.send(msg);
    if (sendgridRes[0].statusCode === 202) {
      return NextResponse.json(
        {
          statusCode: 200,
          status: ApiResponseStatus.SUCCESS,
          data: {
            message: "We have received your message.",
          },
        },
        { status: 200 }
      );
    }
    return NextResponse.json(
      {
        statusCode: 400,
        status: ApiResponseStatus.ERROR,
        message: errorConfig[400],
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error(error);
    return NextResponse.json(
      {
        statusCode: error?.code ?? 500,
        status: ApiResponseStatus.ERROR,
        message: !!error?.code
          ? "Sorry, something went wrong. Please try again later."
          : errorConfig[500],
      },
      { status: error?.code ?? 500 }
    );
  }
}
