"use client";

import { AnthropicModel } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        model={{
          provider: Provider.Anthropic,
          id: AnthropicModel["claude-3-5-haiku"],
        }}
      />
    </ErrorBoundary>
  );
};

export default Default;
