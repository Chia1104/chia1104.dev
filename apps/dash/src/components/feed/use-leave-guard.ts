"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useNavigationGuard } from "@/libs/navigation-guard";

/**
 * In-app navigation saves first and asks only when that fails; closing the tab asks through the
 * browser. Either way the edits stay in local storage and come back with the draft.
 */
export const useLeaveGuard = ({
  isSynced,
  flush,
}: {
  isSynced: boolean;
  flush: () => Promise<boolean>;
}) => {
  const router = useRouter();
  const [blockedHref, setBlockedHref] = useState<string | null>(null);

  useNavigationGuard(async (href) => {
    if (isSynced || (await flush())) return true;
    setBlockedHref(href);
    return false;
  });

  useEffect(() => {
    if (isSynced) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isSynced]);

  return {
    blockedHref,
    stay: () => setBlockedHref(null),
    leave: () => {
      if (blockedHref === null) return;
      setBlockedHref(null);
      router.push(blockedHref);
    },
  };
};
