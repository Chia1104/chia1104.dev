"use client";

import { Accordion, AccordionItem, CircularProgress } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import AuthGuard from "@/components/commons/auth-guard";
import OpenaiForm from "@/components/setting/openai-form";
import PasskeyForm from "@/components/setting/passkey-form";
import ProfileForm from "@/components/setting/profile-form";

const Page = () => {
  return (
    <article className="c-container main justify-start items-start">
      <Accordion
        className="gap-5"
        variant="splitted"
        selectionMode="multiple"
        defaultExpandedKeys={["profile"]}>
        <AccordionItem key="profile" title="Profile">
          <ErrorBoundary>
            <AuthGuard fallback={<CircularProgress />}>
              {(session) => <ProfileForm defaultValues={session.user} />}
            </AuthGuard>
          </ErrorBoundary>
        </AccordionItem>
        <AccordionItem key="openai" title="Openai">
          <ErrorBoundary>
            <OpenaiForm />
          </ErrorBoundary>
        </AccordionItem>
        <AccordionItem key="passkeys" title="Passkeys">
          <ErrorBoundary>
            <PasskeyForm />
          </ErrorBoundary>
        </AccordionItem>
      </Accordion>
    </article>
  );
};

export default Page;
