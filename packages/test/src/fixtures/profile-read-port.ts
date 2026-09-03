/** Structural `ProfileReadPort` fake; the consumer assigns it to the real port type. */
export const createFakeProfileReadPort = <TEntry = never>(
  entries: readonly TEntry[] = []
) => ({
  listPublished: () => Promise.resolve([...entries]),
});
