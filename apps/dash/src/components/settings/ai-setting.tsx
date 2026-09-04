"use client";

import { Tabs } from "@heroui/react";
import { Card } from "@heroui/react";
import { MessageCircle } from "lucide-react";

import { KEY_IDS, KEY_LABELS } from "@chia/ai/provider";

import { AIForm } from "@/components/settings/ai-form";

export const AISetting = () => {
  return (
    <Card className="w-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <MessageCircle size={18} />
          Your AI API Keys
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <Tabs className="w-full">
          <Tabs.ListContainer>
            <Tabs.List>
              {KEY_IDS.map((provider) => (
                <Tabs.Tab key={provider} id={provider}>
                  {KEY_LABELS[provider]}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
          {KEY_IDS.map((provider) => (
            <Tabs.Panel key={provider} className="pt-4" id={provider}>
              <AIForm provider={provider} />
            </Tabs.Panel>
          ))}
        </Tabs>
      </Card.Content>
    </Card>
  );
};
