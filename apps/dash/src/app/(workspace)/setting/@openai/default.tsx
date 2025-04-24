"use client";

import { OpenAIModel } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        model={{ provider: Provider.OpenAI, id: OpenAIModel["gpt-4o-mini"] }}
      />
    </ErrorBoundary>
  );
};

export default Default;
