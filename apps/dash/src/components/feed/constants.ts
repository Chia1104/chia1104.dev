import {
  BookOpen,
  Compass,
  GalleryVerticalEnd,
  Pencil,
  Star,
} from "lucide-react";

import { FeedType, Locale } from "@chia/db/types";

export const FEED_TYPE_TABS = [
  { id: FeedType.Post, icon: GalleryVerticalEnd, label: "Post" },
  { id: FeedType.Note, icon: Pencil, label: "Note" },
  { id: FeedType.Guide, icon: Compass, label: "Guide" },
  { id: FeedType.Review, icon: Star, label: "Review" },
  { id: FeedType.Journal, icon: BookOpen, label: "Journal" },
] as const;

/** The dashboard list a feed of each type is managed in. */
export const feedListHrefOf = (type: FeedType): string =>
  type === FeedType.Post
    ? "/feed/posts"
    : type === FeedType.Note
      ? "/feed/notes"
      : "/feed/hobby";

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
    key: Locale.ZhTW,
    index: 1,
    label: "Chinese (Traditional)",
  },
];
