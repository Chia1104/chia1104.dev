"use client";

import { useRouter } from "next/navigation";

import { Button } from "@heroui/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@chia/auth/client";

/** Shown on every page while the cookie is an impersonation session, so the admin can always get back. */
export const ImpersonationBanner = () => {
  const router = useRouter();
  const { data } = authClient.useSession();
  const stop = useMutation({
    mutationFn: async () => {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) {
        throw new Error(result.error.message ?? "Could not stop impersonating");
      }
    },
    onSuccess() {
      toast.success("Back to your own session");
      router.refresh();
    },
    onError(error) {
      toast.error(error.message);
    },
  });

  if (!data?.session.impersonatedBy) return null;

  return (
    <div className="bg-warning text-warning-foreground sticky top-0 z-50 flex items-center justify-between gap-4 px-4 py-2 text-sm">
      <span>
        Browsing as <strong>{data.user.name}</strong> ({data.user.email}). Every
        page and the public site see this session.
      </span>
      <Button
        isPending={stop.isPending}
        size="sm"
        variant="secondary"
        onPress={() => stop.mutate()}>
        Stop impersonating
      </Button>
    </div>
  );
};
