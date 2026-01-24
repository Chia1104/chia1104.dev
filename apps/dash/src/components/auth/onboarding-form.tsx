"use client";

import { useForm } from "react-hook-form";

import { Input, CardBody, CardFooter, Divider, Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as z from "zod";

import type { Organization } from "@chia/auth/types";
import { Form as FormCtx, FormField } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";

import { orpc } from "@/libs/orpc/client";
import { setCurrentOrg } from "@/server/org.action";

const schema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  logo: z.string().optional(),
});

interface Props {
  onSuccess?: (data: Organization) => void;
}

const OnboardingForm = (props: Props) => {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate } = useMutation(
    orpc.organization.create.mutationOptions({
      onSuccess: async (data) => {
        if (data.slug) {
          await setCurrentOrg(data.slug);
          props?.onSuccess?.(data);
        }
      },
      onError: (error) => {
        toast.error(error.message);
      },
    })
  );

  const handleSubmit = form.handleSubmit((data) => {
    mutate(data);
  });
  return (
    <FormCtx {...form}>
      <Form onSubmit={handleSubmit}>
        <CardBody className="gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({
              field: { onChange, value, onBlur },
              fieldState: { invalid, error },
            }) => (
              <Input
                isRequired
                label="Organization Name"
                placeholder="Enter your organization name"
                isInvalid={invalid}
                errorMessage={error?.message}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
              />
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({
              field: { onChange, value, onBlur },
              fieldState: { invalid, error },
            }) => (
              <Input
                isRequired
                label="URL Slug"
                placeholder="slug"
                startContent={
                  <div className="pointer-events-none flex items-center">
                    <span className="text-default-400 text-small">
                      dash.chia1104.dev/
                    </span>
                  </div>
                }
                description="This will be used for your organization's URL"
                isInvalid={invalid}
                errorMessage={error?.message}
                value={value}
                onChange={onChange}
                onBlur={onBlur}
              />
            )}
          />
        </CardBody>
        <Divider />
        <CardFooter>
          <SubmitForm color="primary" className="w-full">
            Create Organization
          </SubmitForm>
        </CardFooter>
      </Form>
    </FormCtx>
  );
};

export default OnboardingForm;
