/**
 * Public procedures whose answer is the same for every caller, mapped to the `CDN-Cache-Control`
 * a success carries. They travel as credential-less GETs, which skip the CORS preflight and let a
 * CDN answer them. Imports nothing, so browser links read it as well as the handler.
 */
export const SHARED_READS: ReadonlyMap<string, string> = new Map([
  // Not `s-maxage`: it implies `proxy-revalidate`, which turns off `stale-while-revalidate`.
  ["spotify.playing", "max-age=10, stale-while-revalidate=50"],
]);
