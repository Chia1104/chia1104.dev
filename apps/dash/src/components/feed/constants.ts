import { GalleryVerticalEnd, Pencil } from "lucide-react";

import { ContentType, FeedType, Locale } from "@chia/db/types";

export const CONTENT_TYPE_OPTIONS = [
  { key: ContentType.Mdx, label: ContentType.Mdx.toUpperCase() },
  { key: ContentType.Tiptap, label: ContentType.Tiptap.toUpperCase() },
] as const;

export const FEED_TYPE_TABS = [
  { id: FeedType.Post, icon: GalleryVerticalEnd, label: "Post" },
  { id: FeedType.Note, icon: Pencil, label: "Note" },
] as const;

export const SUPPORTED_LOCALES: {
  key: Locale;
  index: number;
  label: string;
}[] = [
  {
    key: Locale.En,
    index: 0,
    label: "English",
  },
  {
    key: Locale.zhTW,
    index: 1,
    label: "Chinese (Traditional)",
  },
];
