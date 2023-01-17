const networkConfig = {
  timeout: 5000,
} as const;

const errorConfig = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  500: "Internal Server Error",
} as const;

export { networkConfig, errorConfig };
