export function getIP<T extends Request>(req: T) {
  try {
    // @ts-expect-error
    let ip = req?.ip ?? req.headers.get("x-real-ip");
    const forwardedFor = req.headers.get("x-forwarded-for");

    if (!ip && forwardedFor) {
      ip = forwardedFor.split(",").at(0) ?? "";
    }

    return ip;
  } catch (error) {
    console.error(error);
    return null;
  }
}
