import { headers } from "next/headers";
import { redirect, unauthorized, notFound } from "next/navigation";

import { authClient } from "@chia/auth/client";

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const headersList = await headers();

  const session = await authClient.getSession({
    fetchOptions: {
      headers: headersList,
    },
  });
  if (!session.data) {
    unauthorized();
  }

  const orgs = await authClient.organization.list({
    fetchOptions: {
      headers: headersList,
    },
  });

  if (orgs.error) {
    notFound();
  }

  if (orgs.data.length > 0) {
    redirect(`/${orgs.data[0].slug}`);
  }

  return children;
};

export default Layout;
