export const splitString = (str?: string | null): string[] => {
  if (!str) {
    return [];
  }
  return str.split(",").map((item) => item.trim());
};

export const getClientIP = (request: Request) => {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0] ??
    request.headers.get("X-Real-IP") ??
    "anonymous"
  );
};
