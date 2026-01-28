"use client";

import { DeepSeekModel } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        model={{
          provider: Provider.DeepSeek,
          id: DeepSeekModel["deepseek-r1"],
        }}
      />
    </ErrorBoundary>
  );
};

export default Default;
