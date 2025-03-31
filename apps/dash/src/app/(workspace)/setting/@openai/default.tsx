"use client";

import { OpenAIModal } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        modal={{ provider: Provider.OpenAI, id: OpenAIModal["gpt-4o-mini"] }}
      />
    </ErrorBoundary>
  );
};

export default Default;
