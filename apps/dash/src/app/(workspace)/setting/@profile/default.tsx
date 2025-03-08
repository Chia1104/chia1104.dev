"use client";

import { CircularProgress } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import AuthGuard from "@/components/commons/auth-guard";
import ProfileForm from "@/components/setting/profile-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AuthGuard fallback={<CircularProgress />}>
        {(session) => <ProfileForm defaultValues={session.user} />}
      </AuthGuard>
    </ErrorBoundary>
  );
};

export default Default;
