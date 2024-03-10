import OpenAI, { APIError } from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { errorGenerator, getAdminId } from "@chia/utils";
import { NextResponse } from "next/server";
import { auth } from "@chia/auth";

// Create an OpenAI API client (that's edge friendly!)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

export const generate = auth(async (req) => {
  try {
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "") {
      return NextResponse.json(errorGenerator(503), {
        status: 503,
        headers: {
          "retry-after": "3600", // retry after 1 hour
        },
      });
    }

    if (!req.auth || req.auth.user?.id !== getAdminId()) {
      return NextResponse.json(
        errorGenerator(403, [
          {
            field: "auth",
            message: "You are not authorized to access this resource.",
          },
        ]),
        {
          status: 403,
        }
      );
    }

    const { prompt } = (await req.json()) as { prompt: string };

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are an AI writing assistant that continues existing text based on context from prior text. " +
            "Give more weight/priority to the later characters than the beginning ones. " +
            "Limit your response to no more than 200 characters, but make sure to construct complete sentences.",
          // we're disabling markdown for now until we can figure out a way to stream markdown text with proper formatting: https://github.com/steven-tey/novel/discussions/7
          // "Use Markdown formatting when appropriate.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      stream: true,
      n: 1,
    });

    // Convert the response into a friendly text-stream
    const stream = OpenAIStream(response);

    // Respond with the stream
    return new StreamingTextResponse(stream);
  } catch (error) {
    if (error instanceof APIError) {
      return NextResponse.json(errorGenerator((error.status as any) ?? 500), {
        status: error.status,
      });
    }
    return NextResponse.json(errorGenerator(500), {
      status: 500,
    });
  }
});
