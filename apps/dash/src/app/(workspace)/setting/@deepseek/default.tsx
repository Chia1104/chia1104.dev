"use client";

import { DeepSeekModal } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        modal={{
          provider: Provider.DeepSeek,
          id: DeepSeekModal["deepseek-r1"],
        }}
      />
    </ErrorBoundary>
  );
};

export default Default;
