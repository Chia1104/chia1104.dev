"use client";

import { AnthropicModal } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        modal={{
          provider: Provider.Anthropic,
          id: AnthropicModal["claude-3-5-haiku"],
        }}
      />
    </ErrorBoundary>
  );
};

export default Default;
