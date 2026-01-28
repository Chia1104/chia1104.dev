"use client";

import { Spinner } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import AuthGuard from "@/components/commons/auth-guard";
import { AISetting } from "@/components/settings/ai-setting";
import { OrgSetting } from "@/components/settings/org-setting";
import { ProfileSetting } from "@/components/settings/profile-setting";

const Pages = () => {
  return (
    <div className="mx-auto flex w-full max-w-175 flex-col items-start gap-5 p-4 py-10">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ErrorBoundary>
        <AuthGuard fallback={<Spinner />}>
          {(session) => <ProfileSetting defaultValues={session.user} />}
        </AuthGuard>
      </ErrorBoundary>
      <AISetting />
      <OrgSetting />
    </div>
  );
};

export default Pages;
