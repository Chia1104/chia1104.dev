/** Header and query keys that carry the client's address or identity. */
const CLIENT_IDENTITY_KEYS = ["forwarded", "-ip", "remote-", "via", "-user"];

/** Keeps request bodies, cookies and user data out of events; an unset category collects everything. */
export const sentryDataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: CLIENT_IDENTITY_KEYS },
    response: { deny: CLIENT_IDENTITY_KEYS },
  },
  httpBodies: [],
  urlQueryParams: { deny: CLIENT_IDENTITY_KEYS },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  graphQL: { document: false, variables: false },
};
