import { ViewTransition } from "react";

import { OnboardingForm } from "@/components/auth/onboarding-form";

const Default = () => {
  return (
    <ViewTransition>
      <section className="flex w-full max-w-lg flex-col gap-5 px-5">
        <h1 className="text-lg font-bold">Complete Your Organization</h1>
        <OnboardingForm />
      </section>
    </ViewTransition>
  );
};

export default Default;
