"use client";

import { Accordion, AccordionItem } from "@heroui/react";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import OpenaiForm from "./_components/openai-form";
import ProfileForm from "./_components/profile-form";

const Page = () => {
  return (
    <Accordion
      variant="splitted"
      selectionMode="multiple"
      defaultExpandedKeys={["profile"]}>
      <AccordionItem key="profile" title="Profile">
        <ProfileForm />
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
