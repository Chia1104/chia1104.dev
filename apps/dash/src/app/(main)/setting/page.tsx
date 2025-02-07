"use client";

import { Accordion, AccordionItem, CircularProgress } from "@heroui/react";

import { authClient } from "@chia/auth/client";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AuthGuard from "@/components/commons/auth-guard";
import OpenaiForm from "@/components/setting/openai-form";
import ProfileForm from "@/components/setting/profile-form";

const Page = () => {
  const session = authClient.useSession();
  return (
    <Accordion
      variant="splitted"
      selectionMode="multiple"
      defaultExpandedKeys={["profile"]}>
      <AccordionItem
        key="profile"
        title="Profile"
        isDisabled={!session.data || session.isPending}>
        <AuthGuard fallback={<CircularProgress />}>
          {(session) => <ProfileForm defaultValues={session.user} />}
        </AuthGuard>
      </AccordionItem>
      <AccordionItem key="openai" title="Openai">
        <ErrorBoundary>
          <OpenaiForm />
        </ErrorBoundary>
      </AccordionItem>
    </Accordion>
  );
};

export default Page;
