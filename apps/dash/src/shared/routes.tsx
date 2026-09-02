"use client";

import { useSelectedLayoutSegments } from "next/navigation";
import { useMemo } from "react";

import {
  Home,
  Bookmark,
  Settings,
  KeySquare,
  Notebook,
  PenSquare,
  File,
  Music2,
  Bot,
  Database,
  Boxes,
  Activity,
  Wrench,
  Brain,
  SlidersHorizontal,
  Users,
} from "lucide-react";

import type { NavMainItem } from "@/components/commons/nav-main";

type RouteGroup = "overview" | "content" | "rag" | "agents" | "settings";

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
        {
          url: "/users",
          icon: <Users />,
          title: "Users",
          isActive: segments[0] === "users",
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
        {
          url: "/agent",
          isActive: segments[0] === "agent",
          icon: <Bot />,
          title: "Writing Agent",
        },
      ],
      rag: [
        {
          url: "/rag",
          isActive: segments[0] === "rag",
          icon: <Database />,
          title: "RAG",
          items: [
            {
              url: "/rag",
              icon: <Database />,
              title: "Overview",
              isActive: segments[0] === "rag" && segments.length === 1,
            },
            {
              url: "/rag/chunks",
              icon: <Boxes />,
              title: "Chunks",
              isActive: segments[0] === "rag" && segments[1] === "chunks",
            },
            {
              url: "/rag/runs",
              icon: <Activity />,
              title: "Index Runs",
              isActive: segments[0] === "rag" && segments[1] === "runs",
            },
            {
              url: "/rag/maintenance",
              icon: <Wrench />,
              title: "Maintenance",
              isActive: segments[0] === "rag" && segments[1] === "maintenance",
            },
          ],
        },
      ],
      agents: [
        {
          url: "/agents",
          isActive: segments[0] === "agents",
          icon: <SlidersHorizontal />,
          title: "Agents",
        },
        {
          url: "/memory",
          isActive: segments[0] === "memory",
          icon: <Brain />,
          title: "Agent Memory",
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
        {
          url: "/api-keys",
          icon: <KeySquare />,
          title: "API Keys",
          isActive: segments[0] === "api-keys",
        },
      ],
    } satisfies Record<RouteGroup, NavMainItem[]>;
  }, [segments]);
};
