import type { ReactNode } from "react";

import { DocsLayout } from "fumadocs-ui/layout";

import { getDoc } from "@/services/fumadocs.service";

const Layout = async ({
  children,
  params,
}: {
  children: ReactNode;
  params: { slug: string };
}) => {
  const doc = await getDoc(params.slug, "post");

  return (
    <DocsLayout
      tree={doc.pageTree}
      sidebar={{ enabled: false }}
      containerProps={{
        className: "w-full",
      }}>
      {children}
    </DocsLayout>
  );
};

export default Layout;
