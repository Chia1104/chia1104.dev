"use client";

import { GoogleModel } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import { ErrorBoundary } from "@chia/ui/error-boundary";

import AiForm from "@/components/setting/ai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <AiForm
        model={{
          provider: Provider.Google,
          id: GoogleModel["gemini-2.0-flash"],
        }}
      />
    </ErrorBoundary>
  );
};

export default Default;
