"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@heroui/react";
import { LogOut } from "lucide-react";

import { authClient } from "@chia/auth/client";

import { revokeCurrentOrg } from "@/server/org.action";

export const Logout = () => {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <Button
      isPending={isPending}
      variant="danger-soft"
      fullWidth
      onPress={() =>
        startTransition(async () => {
          await revokeCurrentOrg();
          await authClient.signOut({
            fetchOptions: {
              onSuccess: () => {
                router.push("/auth/login");
              },
            },
          });
        })
      }>
      <LogOut className="size-4" />
      <span>Logout</span>
    </Button>
  );
};
