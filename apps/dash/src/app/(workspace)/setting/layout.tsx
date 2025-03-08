"use client";

import { Accordion, AccordionItem } from "@heroui/react";

const Layout = ({
  openai,
  passkey,
  profile,
  organization,
}: {
  openai: React.ReactNode;
  passkey: React.ReactNode;
  profile: React.ReactNode;
  organization: React.ReactNode;
}) => {
  return (
    <article className="c-container main justify-start items-start">
      <Accordion
        className="gap-5"
        variant="splitted"
        selectionMode="multiple"
        defaultExpandedKeys={["profile"]}>
        <AccordionItem key="profile" title="Profile">
          {profile}
        </AccordionItem>
        <AccordionItem key="openai" title="Openai">
          {openai}
        </AccordionItem>
        <AccordionItem key="passkeys" title="Passkeys">
          {passkey}
        </AccordionItem>
        <AccordionItem key="organization" title="Organization">
          {organization}
        </AccordionItem>
      </Accordion>
    </article>
  );
};

export default Layout;
