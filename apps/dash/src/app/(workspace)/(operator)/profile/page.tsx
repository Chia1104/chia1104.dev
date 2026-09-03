import "server-only";
import { Suspense } from "react";

import { Spinner } from "@heroui/react";

import { ProfileManager } from "@/components/profile/profile-manager";

export const dynamic = "force-dynamic";

const ProfilePage = () => (
  <section className="flex w-full flex-col gap-6">
    <h1 className="text-2xl font-semibold">Profile</h1>
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      }>
      <ProfileManager />
    </Suspense>
  </section>
);

export default ProfilePage;
