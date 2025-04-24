import { unauthorized } from "next/navigation";

import { getSession, listOrganizations } from "@/services/auth/resources.rsc";

const Layout = async ({
  children: _children,
  create,
  list,
}: {
  children: React.ReactNode;
  create: React.ReactNode;
  list: React.ReactNode;
}) => {
  const session = await getSession();

  if (!session.data) {
    unauthorized();
  }

  const orgs = await listOrganizations();

  if (!orgs.data || orgs.data.length === 0) {
    return <section className="container main">{create}</section>;
  }

  return <section className="container main">{list}</section>;
};

export default Layout;
