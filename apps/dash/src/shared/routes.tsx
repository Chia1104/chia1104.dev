"use client";

import { Icon } from "@iconify/react";

import type { SidebarItem } from "@/components/commons/side-bar";
import CreateFeed from "@/components/feed/create-feed";

export const routeItems: SidebarItem[] = [
  {
    key: "metrics",
    href: "/",
    icon: "solar:home-2-linear",
    title: "Metrics",
  },
  {
    key: "projects",
    href: "/projects",
    icon: "solar:widget-2-outline",
    title: "Projects",
    endContent: (
      <Icon
        className="text-default-400"
        icon="solar:add-circle-line-duotone"
        width={24}
      />
    ),
    isDisabled: true,
  },
  {
    key: "feed",
    href: "/feed",
    icon: "solar:bookmark-broken",
    title: "Feed",
    items: [
      {
        key: "posts",
        href: "/feed/posts",
        icon: "solar:bookmark-broken",
        title: "Posts",
      },
      {
        key: "notes",
        href: "/feed/notes",
        icon: "solar:notebook-line-duotone",
        title: "Notes",
      },
      {
        key: "drafts",
        href: "/feed/drafts",
        icon: "solar:pen-new-square-line-duotone",
        title: "Drafts",
      },
    ],
    action: <CreateFeed />,
  },
  {
    key: "setting",
    href: "/setting",
    icon: "solar:settings-outline",
    title: "Setting",
  },
];
