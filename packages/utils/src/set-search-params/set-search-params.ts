const setSearchParams = <T extends Partial<Record<string, string | null>>>(
  searchParams?: T
) => {
  return Object.entries({ ...searchParams })
    .map(
      ([key, value]) =>
        value && `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .filter(Boolean)
    .join("&");
};

export default setSearchParams;
