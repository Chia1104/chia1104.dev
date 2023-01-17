import sendgrid from "@sendgrid/mail";
import { Chia } from "@chia/shared/meta/chia";
import type { NextApiRequest, NextApiResponse } from "next";
import { IApiResponse, ApiResponseStatus } from "@chia/utils/fetcher.util";
import { errorConfig } from "@chia/config/network.config";
import { z } from "zod";

sendgrid.setApiKey(process.env.SENDGRID_KEY ?? "");

const contactSchema = z.object({
  email: z.string().email(),
  message: z.string(),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<IApiResponse<{ message: string }>>
) {
  switch (req.method) {
    case "POST":
      try {
        const { email, message } = req.body;

        if (!contactSchema.safeParse(req.body).success) {
          return res.status(400).json({
            statusCode: 400,
            status: ApiResponseStatus.ERROR,
            message: errorConfig[400],
          });
        }

        const msg = {
          to: Chia.email,
          from: Chia.email,
          subject: `Message from ${email} via chia.1104.dev`,
          text: message,
        };
        const sendgridRes = await sendgrid.send(msg);
        if (sendgridRes[0].statusCode === 202) {
          return res.status(200).json({
            statusCode: 200,
            status: ApiResponseStatus.SUCCESS,
            data: {
              message: "We have received your message.",
            },
          });
        }
        return res.status(400).json({
          statusCode: 400,
          status: ApiResponseStatus.ERROR,
          message: errorConfig[400],
        });
      } catch (error: any) {
        console.error(error);
        return res.status(error?.code ?? 500).json({
          statusCode: error?.code ?? 500,
          status: ApiResponseStatus.ERROR,
          message: !!error?.code
            ? "Sorry, something went wrong. Please try again later."
            : errorConfig[500],
        });
      }
    default:
      return res.status(405).json({
        statusCode: 405,
        status: ApiResponseStatus.ERROR,
        message: `Method ${req.method} Not Allowed`,
      });
  }
}
