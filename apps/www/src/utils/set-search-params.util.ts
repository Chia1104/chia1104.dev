export interface SetSearchParamsOptions {
  searchParams: Partial<Record<string, string>>;
}

const setSearchParams = (searchParamsOptions: SetSearchParamsOptions) => {
  const { searchParams } = searchParamsOptions;
  return Object.entries({
    ...searchParams,
  })
    .map(
      ([key, value]) =>
        value && `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .filter(Boolean)
    .join("&");
};

export default setSearchParams;
