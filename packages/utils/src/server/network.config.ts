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
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  503: "Service Unavailable",
} as const;

export { networkConfig, errorConfig };
