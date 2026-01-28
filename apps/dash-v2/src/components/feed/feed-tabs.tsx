"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

import { Tabs } from "@heroui/react";
import { FileText, StickyNote, FilePenLine } from "lucide-react";

import { cn } from "@chia/ui/utils/cn.util";

const FEED_TABS = [
  {
    key: "posts",
    label: "Posts",
    icon: FileText,
    href: "/feed/posts",
  },
  {
    key: "notes",
    label: "Notes",
    icon: StickyNote,
    href: "/feed/notes",
  },
  {
    key: "drafts",
    label: "Drafts",
    icon: FilePenLine,
    href: "/feed/drafts",
  },
] as const;

const FeedTabs = ({ className }: { className?: string }) => {
  const router = useRouter();
  const pathname = usePathname();

  const selectedKey = useMemo(() => {
    const matchedTab = FEED_TABS.find((tab) => pathname.includes(tab.key));
    return matchedTab?.key ?? "posts";
  }, [pathname]);

  const handleSelectionChange = useCallback(
    (key: React.Key) => {
      const tab = FEED_TABS.find((t) => t.key === key);
      if (tab) {
        router.push(tab.href);
      }
    },
    [router]
  );

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
      className={cn("w-full", className)}>
      <Tabs.List aria-label="Feed navigation tabs">
        {FEED_TABS.map(({ key, label, icon: Icon }) => (
          <Tabs.Tab key={key} id={key}>
            <div className="flex items-center gap-2">
              <Icon className="size-4" />
              <span>{label}</span>
            </div>
            <Tabs.Indicator />
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
};

export default FeedTabs;
