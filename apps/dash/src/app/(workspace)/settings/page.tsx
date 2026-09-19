"use client";

import { Spinner } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import AuthGuard from "@/components/commons/auth-guard";
import { AISetting } from "@/components/settings/ai-setting";
import { ProfileSetting } from "@/components/settings/profile-setting";

const Pages = () => {
  return (
    <div className="page-container flex flex-col items-start gap-5 py-8">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <ErrorBoundary>
        <AuthGuard fallback={<Spinner />}>
          {(session) => <ProfileSetting defaultValues={session.user} />}
        </AuthGuard>
      </ErrorBoundary>
      <AISetting />
    </div>
  );
};

export default Pages;
