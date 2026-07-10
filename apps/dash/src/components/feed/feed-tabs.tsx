"use client";

import { useRouter, useSelectedLayoutSegments } from "next/navigation";
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
  const selectedLayoutSegments = useSelectedLayoutSegments();

  const selectedKey = useMemo(() => {
    const matchedTab = FEED_TABS.find((tab) =>
      selectedLayoutSegments?.includes(tab.key)
    );
    return matchedTab?.key;
  }, [selectedLayoutSegments]);

  const handleSelectionChange = useCallback(
    (key: React.Key) => {
      const tab = FEED_TABS.find((t) => t.key === key);
      if (tab && tab.key !== selectedKey) {
        router.push(tab.href);
      }
    },
    [router, selectedKey]
  );

  return (
    <Tabs
      selectedKey={selectedKey}
      onSelectionChange={handleSelectionChange}
      className={cn("w-full", className)}>
      <Tabs.ListContainer>
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
      </Tabs.ListContainer>
    </Tabs>
  );
};

export default FeedTabs;
