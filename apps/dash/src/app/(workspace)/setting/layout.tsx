"use client";

import { Accordion, AccordionItem } from "@heroui/react";
import { Divider } from "@heroui/react";

const Layout = ({
  openai,
  anthropic,
  google,
  passkey,
  profile,
  organization,
}: {
  openai: React.ReactNode;
  anthropic: React.ReactNode;
  google: React.ReactNode;
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
        <AccordionItem key="openai" title="AI API Key">
          <h3 className="text-lg font-bold mb-5">OpenAI</h3>
          {openai}
          <Divider className="my-5" />
          <h3 className="text-lg font-bold my-5">Anthropic</h3>
          {anthropic}
          <Divider className="my-5" />
          <h3 className="text-lg font-bold my-5">Google</h3>
          {google}
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
