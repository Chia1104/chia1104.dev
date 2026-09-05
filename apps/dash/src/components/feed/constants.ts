import { GalleryVerticalEnd, Pencil } from "lucide-react";

import { FeedType, Locale } from "@chia/db/types";

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
