import "server-only";
import { headers } from "next/headers";
import { cache } from "react";

import { authClient } from "@chia/auth/client";

export const getSession = cache(async () => {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
    },
  });
  return session;
});

export const getFullOrganization = cache(async (org: string) => {
  const orgs = await authClient.organization.getFullOrganization({
    fetchOptions: {
      headers: await headers(),
    },
    query: {
      organizationSlug: org,
    },
  });
  return orgs;
});

export const listOrganizations = cache(async () => {
  const orgs = await authClient.organization.list({
    fetchOptions: {
      headers: await headers(),
    },
  });
  return orgs;
});
