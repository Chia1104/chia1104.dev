export const omitUndefined = <T extends object>(value: T): Partial<T> => {
  const defined: Partial<T> = {};
  for (const key in value) {
    if (Object.hasOwn(value, key) && value[key] !== undefined) {
      defined[key] = value[key];
    }
  }
  return defined;
};

/** Applies a patch; `undefined` means leave unchanged. */
export const mergeDefined = <T extends object>(
  base: T,
  patch: Partial<T>
): T => ({ ...base, ...omitUndefined(patch) });
