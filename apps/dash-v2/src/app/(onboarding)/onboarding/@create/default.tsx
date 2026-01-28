import { OnboardingForm } from "@/components/auth/onboarding-form";

const Default = () => {
  return (
    <section className="flex w-full max-w-lg flex-col gap-5 px-5">
      <h1 className="text-lg font-bold">Complete Your Organization</h1>
      <OnboardingForm />
    </section>
  );
};

export default Default;
