export const omitUndefined = <T extends object>(value: T): Partial<T> => {
  const entries = Object.entries(value).filter(
    ([, entry]) => entry !== undefined
  );
  // SAFETY: filtering entries removes values but never changes a surviving key or value.
  return Object.fromEntries(entries) as Partial<T>;
};

/** Applies a patch; `undefined` means leave unchanged. */
export const mergeDefined = <T extends object>(
  base: T,
  patch: Partial<T>
): T => ({ ...base, ...omitUndefined(patch) });
