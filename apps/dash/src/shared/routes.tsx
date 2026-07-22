"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { useMemo } from "react";

import {
  Home,
  Bookmark,
  Settings,
  Folder,
  KeySquare,
  Notebook,
  PenSquare,
  File,
  Music2,
} from "lucide-react";

import type { NavMainItem } from "@/components/commons/nav-main";

type RouteGroup = "overview" | "project" | "content" | "settings";

export const useRouteItems = () => {
  const segments = useSelectedLayoutSegments();
  return useMemo(() => {
    return {
      overview: [
        {
          url: "/",
          icon: <Home />,
          title: "Overview",
          isActive: segments.length === 0,
        },
      ],
      project: [
        {
          url: "/projects",
          icon: <Folder />,
          title: "Projects",
          isActive: segments[0] === "projects",
          items: [
            {
              url: "/projects/api-key",
              icon: <KeySquare />,
              title: "Api Keys",
              isActive: segments[0] === "projects" && segments[1] === "api-key",
            },
          ],
        },
      ],
      content: [
        {
          url: "/feed",
          isActive: segments[0] === "feed",
          icon: <Bookmark />,
          title: "Content",
          items: [
            {
              url: "/feed/posts",
              icon: <Bookmark />,
              title: "Posts",
              isActive: segments[0] === "feed" && segments[1] === "posts",
            },
            {
              url: "/feed/notes",
              icon: <Notebook />,
              title: "Notes",
              isActive: segments[0] === "feed" && segments[1] === "notes",
            },
            {
              url: "/feed/drafts",
              icon: <PenSquare />,
              title: "Drafts",
              isActive: segments[0] === "feed" && segments[1] === "drafts",
            },
          ],
        },
        {
          url: "/assets",
          isActive: segments[0] === "assets",
          icon: <File />,
          title: "Assets",
        },
      ],
      settings: [
        {
          url: "/settings",
          isActive: segments[0] === "settings",
          icon: <Settings />,
          title: "Settings",
          items: [
            {
              url: "/settings",
              icon: <Settings />,
              title: "General",
              isActive: segments[0] === "settings" && segments.length === 1,
            },
            {
              url: "/settings/spotify",
              icon: <Music2 />,
              title: "Spotify",
              isActive: segments[0] === "settings" && segments[1] === "spotify",
            },
          ],
        },
      ],
    } satisfies Record<RouteGroup, NavMainItem[]>;
  }, [segments]);
};
