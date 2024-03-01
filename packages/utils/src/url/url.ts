interface Options {
  baseUrl?: string;
}

export const setSearchParams = <
  T extends Partial<Record<string, string | null>>,
>(
  searchParams?: T,
  opts?: Options
) => {
  opts ??= {};
  const { baseUrl } = opts;
  // url without end slash and ensure with question mark
  const url = baseUrl
    ? baseUrl.replace(/\/$/, "").replace(/\?$/, "") + "?"
    : "";
  return (
    url +
    Object.entries({ ...searchParams })
      .map(
        ([key, value]) =>
          value && `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
      )
      .filter(Boolean)
      .join("&")
  );
};

export const encodeUrlEncoded = <
  T extends Partial<Record<string, string | null>>,
>(
  object: T
) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(object)) {
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, v));
    } else if (!!value) {
      params.append(key, value);
    }
  }

  return params.toString();
};
