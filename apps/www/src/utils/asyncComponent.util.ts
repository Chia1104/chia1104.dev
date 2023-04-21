export function asyncComponent<T, R>(
  fn: (arg: T) => Promise<R>
): (arg: T) => R {
  // @ts-ignore
  return fn as (arg: T) => R;
}
