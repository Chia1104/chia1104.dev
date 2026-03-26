import { useMemo } from "react";

import dayjs from "dayjs";
import { z } from "zod";

export const useFormRules = () => {
  const messages = useMemo(
    () => ({
      primitive: {
        required_error: "Required",
        invalid_type_error: "Invalid type",
      },
    }),
    []
  );

  const patterns = useMemo(
    () => ({
      /**
       * 電子郵件
       */
      email: z.email({
        error: "Email is invalid",
      }),
      /**
       * 必填字串
       */
      required: z
        .string({
          error: messages.primitive.invalid_type_error,
        })
        .min(1, {
          error: messages.primitive.required_error,
        }),
      /**
       * URL 格式
       */
      url: z.union([
        z
          .url({
            error: "URL is invalid",
          })
          .startsWith("http://", {
            error: "URL must start with http://",
          }),
        z
          .url({
            error: "URL is invalid",
          })
          .startsWith("https://", {
            error: "URL must start with https://",
          }),
      ]),
      /**
       * dayjs 實例
       */
      dayjs: z.instanceof(dayjs as unknown as typeof dayjs.Dayjs, {
        error: messages.primitive.invalid_type_error,
      }),
      /**
       * 時間戳
       */
      timeStamps: z.number({
        error: messages.primitive.invalid_type_error,
      }),
      /**
       * 數字字串
       */
      numericString: z
        .string({
          error: messages.primitive.invalid_type_error,
        })
        .pipe(
          z.coerce.number({
            error: messages.primitive.invalid_type_error,
          })
        ),
      /**
       * 大於 0 的整數
       */
      moreThenZeroNumber: z
        .number({
          error: "Must be greater than 0",
        })
        .int({
          error: "Must be greater than 0",
        })
        .positive({
          error: "Must be greater than 0",
        }),
      /**
       * 整數
       */
      intNumber: z
        .number({
          error: "Must be an integer",
        })
        .int({
          error: "Must be an integer",
        }),
      number: z.number({
        error: "Must be a number",
      }),
      /**
       * 大於等於 0 的整數
       */
      greaterThanOrEqualToZeroNumber: z
        .number({
          error: "Must be a number",
        })
        .int({
          error: "Must be an integer",
        })
        .min(0, {
          error: "Must be greater than or equal to 0",
        }),
      /**
       * 字串 允許空字串
       */
      text: z.string({
        error: messages.primitive.invalid_type_error,
      }),
      /**
       * 布林值
       */
      boolean: z.boolean({
        error: messages.primitive.invalid_type_error,
      }),
      /**
       * 大整數
       */
      bigint: z.bigint({
        error: messages.primitive.invalid_type_error,
      }),
      /**
       * 圖片
       */
      image: z
        .file({
          error: "File is required",
        })
        .min(1, {
          error: "File is required",
        })
        .max(10 * 1024 * 1024, {
          error: "File size must be less than 10MB",
        })
        .mime(
          ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"],
          {
            error: "File must be an image",
          }
        ),
      /**
       * PDF
       */
      pdf: z
        .file({
          error: "File is required",
        })
        .min(1, {
          error: "File is required",
        })
        .max(50 * 1024 * 1024, {
          error: "File size must be less than 50MB",
        })
        .mime(["application/pdf"], {
          error: "File must be a PDF",
        }),
      /**
       * 影片
       */
      video: z
        .file({
          error: "File is required",
        })
        .min(1, {
          error: "File is required",
        })
        .max(500 * 1024 * 1024, {
          error: "File size must be less than 500MB",
        })
        .mime(
          [
            "video/mp4",
            "video/webm",
            "video/quicktime",
            "video/x-msvideo",
            "video/avi",
          ],
          {
            error: "File must be a video",
          }
        ),
      /**
       * 通用 asset（圖片 10MB / PDF 50MB / 影片 500MB）
       */
      asset: z.union([
        z
          .file({ error: "File is required" })
          .min(1, { error: "File is required" })
          .max(10 * 1024 * 1024, { error: "File size must be less than 10MB" })
          .mime(
            [
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/heic",
              "image/heif",
            ],
            { error: "Invalid file type or size" }
          ),
        z
          .file({ error: "File is required" })
          .min(1, { error: "File is required" })
          .max(50 * 1024 * 1024, { error: "File size must be less than 50MB" })
          .mime(["application/pdf"], { error: "Invalid file type or size" }),
        z
          .file({ error: "File is required" })
          .min(1, { error: "File is required" })
          .max(500 * 1024 * 1024, {
            error: "File size must be less than 500MB",
          })
          .mime(
            [
              "video/mp4",
              "video/webm",
              "video/quicktime",
              "video/x-msvideo",
              "video/avi",
            ],
            { error: "Invalid file type or size" }
          ),
      ]),
    }),
    [messages.primitive]
  );

  return {
    messages,
    patterns,
  };
};
