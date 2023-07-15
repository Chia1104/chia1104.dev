interface Options {
  baseUrl?: string;
}

const setSearchParams = <T extends Partial<Record<string, string | null>>>(
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

export default setSearchParams;
