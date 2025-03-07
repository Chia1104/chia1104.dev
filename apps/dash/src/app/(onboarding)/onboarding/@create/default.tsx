"use client";

import { Card, CardHeader, Divider } from "@heroui/react";

import OnboardingForm from "@/components/auth/onboarding-form";

const Default = () => {
  return (
    <div className="c-container main flex-col gap-5 px-5">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold">
            Complete Your First Organization
          </h1>
          <p className="text-default-500 text-center">
            Let's set up your organization
          </p>
        </CardHeader>
        <Divider />
        <OnboardingForm />
      </Card>
    </div>
  );
};

export default Default;
