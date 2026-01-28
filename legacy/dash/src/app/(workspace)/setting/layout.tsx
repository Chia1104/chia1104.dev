"use client";

import { Accordion, AccordionItem } from "@heroui/react";
import { Divider } from "@heroui/react";

const Layout = ({
  openai,
  anthropic,
  google,
  deepseek,
  passkey,
  profile,
  organization,
}: {
  openai: React.ReactNode;
  anthropic: React.ReactNode;
  google: React.ReactNode;
  deepseek: React.ReactNode;
  passkey: React.ReactNode;
  profile: React.ReactNode;
  organization: React.ReactNode;
}) => {
  return (
    <article className="main container items-start justify-start">
      <Accordion
        className="gap-5"
        variant="splitted"
        selectionMode="multiple"
        defaultExpandedKeys={["profile"]}>
        <AccordionItem key="profile" title="Profile">
          {profile}
        </AccordionItem>
        <AccordionItem key="openai" title="AI API Key">
          <h3 className="mb-5 text-lg font-bold">OpenAI</h3>
          {openai}
          <Divider className="my-5" />
          <h3 className="my-5 text-lg font-bold">Anthropic</h3>
          {anthropic}
          <Divider className="my-5" />
          <h3 className="my-5 text-lg font-bold">Google</h3>
          {google}
          <Divider className="my-5" />
          <h3 className="my-5 text-lg font-bold">DeepSeek</h3>
          {deepseek}
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
