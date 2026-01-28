"use client";

import { Tabs } from "@heroui/react";
import { Card } from "@heroui/react";
import { MessageCircle } from "lucide-react";

import {
  AnthropicModel,
  OpenAIModel,
  GoogleModel,
  DeepSeekModel,
} from "@chia/ai/types";
import { Provider } from "@chia/ai/types";

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
              <Tabs.Tab id="openai">
                OpenAI
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="anthropic">
                Anthropic
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="google">
                Google
                <Tabs.Indicator />
              </Tabs.Tab>
              <Tabs.Tab id="deepseek">
                DeepSeek
                <Tabs.Indicator />
              </Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>
          <Tabs.Panel className="pt-4" id="openai">
            <AIForm
              model={{
                provider: Provider.OpenAI,
                id: OpenAIModel["gpt-4o-mini"],
              }}
            />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="anthropic">
            <AIForm
              model={{
                provider: Provider.Anthropic,
                id: AnthropicModel["claude-3-5-haiku"],
              }}
            />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="google">
            <AIForm
              model={{
                provider: Provider.Google,
                id: GoogleModel["gemini-2.0-flash"],
              }}
            />
          </Tabs.Panel>
          <Tabs.Panel className="pt-4" id="deepseek">
            <AIForm
              model={{
                provider: Provider.DeepSeek,
                id: DeepSeekModel["deepseek-r1"],
              }}
            />
          </Tabs.Panel>
        </Tabs>
      </Card.Content>
    </Card>
  );
};
