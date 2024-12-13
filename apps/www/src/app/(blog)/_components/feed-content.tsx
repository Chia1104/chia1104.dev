"use client";

import type { ComponentPropsWithoutRef } from "react";

import { Content, ContentProvider } from "@chia/contents/content";

type Props = ComponentPropsWithoutRef<typeof ContentProvider> & {
  createdAt: string;
};

const FeedContent = ({ createdAt, ...props }: Props) => {
  return (
    <ContentProvider {...props}>
      <Content updatedAt={createdAt} {...props} />
    </ContentProvider>
  );
};

export default FeedContent;
