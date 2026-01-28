"use client";

import { useTransitionRouter } from "next-view-transitions";

import { Card, CardHeader, Divider } from "@heroui/react";

import OnboardingForm from "@/components/auth/onboarding-form";

const Default = () => {
  const router = useTransitionRouter();
  return (
    <div className="flex-col gap-5 px-5">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-center gap-2 p-5">
          <h1 className="text-lg font-bold">
            Complete Your First Organization
          </h1>
          <p className="text-default-500 text-center text-sm">
            Let's set up your organization
          </p>
        </CardHeader>
        <Divider />
        <OnboardingForm onSuccess={() => router.push("/projects")} />
      </Card>
    </div>
  );
};

export default Default;
