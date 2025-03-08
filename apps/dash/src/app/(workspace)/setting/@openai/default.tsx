"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import OpenaiForm from "@/components/setting/openai-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <OpenaiForm />
    </ErrorBoundary>
  );
};

export default Default;
