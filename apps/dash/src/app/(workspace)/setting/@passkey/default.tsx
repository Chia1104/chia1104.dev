"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import PasskeyForm from "@/components/setting/passkey-form";

const Default = () => {
  return (
    <ErrorBoundary>
      <PasskeyForm />
    </ErrorBoundary>
  );
};

export default Default;
