import { ViewTransition } from "react";

import { Description, Separator } from "@heroui/react";

import { Role } from "@chia/db/types";

import { Logout } from "@/components/auth/logout";
import { OnboardingForm } from "@/components/auth/onboarding-form";
import AuthGuard from "@/components/commons/auth-guard";

const Page = () => {
  return (
    <ViewTransition>
      <section className="flex w-full max-w-lg flex-col gap-5 px-5">
        <h1 className="text-lg font-bold">Complete Your Organization</h1>
        <AuthGuard
          roles={[Role.Admin, Role.Root]}
          fallback={
            <>
              <Description>
                Sorry, you are not authorized to create an organization. Please
                contact your administrator.
              </Description>
              <OnboardingForm isDisabled />
            </>
          }>
          <OnboardingForm />
        </AuthGuard>
        <span className="flex items-center gap-2">
          <Separator className="flex-1" />
          <span className="text-muted-foreground text-sm">
            Or login as an administrator
          </span>
          <Separator className="flex-1" />
        </span>
        <Logout />
      </section>
    </ViewTransition>
  );
};

export default Page;
