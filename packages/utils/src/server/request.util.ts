import { encodeUrlEncoded } from "../url/url";
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";

export const encodeJson = <T extends Record<string, unknown>>(obj: T) => {
  return JSON.stringify(obj);
};

/**
 * Server only supports
 * @param req ExpressRequest
 * @returns string | ReadableStream<Uint8Array>
 */
export const encodeRequestBody = (req: ExpressRequest) => {
  const contentType = req.headers["content-type"];

  if (contentType?.includes("application/x-www-form-urlencoded")) {
    return encodeUrlEncoded(req.body);
  }

  if (contentType?.includes("application/json")) {
    return encodeJson(req.body);
  }

  return req.body;
};

export const toWebRequest = (req: ExpressRequest) => {
  const url = req.protocol + "://" + req.get("host") + req.originalUrl;

  const headers = new Headers();

  Object.entries(req.headers).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => {
        v && headers.append(key, v);
      });
      return;
    }

    value && headers.append(key, value);
  });

  // GET and HEAD not allowed to receive body
  const body = /GET|HEAD/.test(req.method) ? undefined : encodeRequestBody(req);

  const request = new Request(url, {
    method: req.method,
    headers,
    body,
  });

  return request;
};

export const toExpressResponse = async (
  response: Response,
  res: ExpressResponse
) => {
  response.headers.forEach((value, key) => {
    if (value) {
      res.append(key, value);
    }
  });

  res.writeHead(response.status, response.statusText, {
    "Content-Type": response.headers.get("content-type") ?? "",
  });

  res.write(await response.text());
  res.end();
};
