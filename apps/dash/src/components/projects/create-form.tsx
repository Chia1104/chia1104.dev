"use client";

import { Input, CardBody, CardFooter, Divider, Form } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod/v4";

import type { Project } from "@chia/db/schema";
import { Form as FormCtx, FormField } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";

import { api } from "@/trpc/client";

const schema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  logo: z.string().optional(),
});

interface Props {
  onSuccess?: (data: Project) => void;
  organizationId: string;
}

const CreateForm = (props: Props) => {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate } = api.organization.createProject.useMutation({
    onSuccess: (data) => {
      if (data) {
        props?.onSuccess?.(data[0]);
      }
      toast.success("Project created successfully");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    mutate({
      ...data,
      organizationId: props.organizationId,
    });
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
                label="Project Name"
                placeholder="Enter your project name"
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
                label="Project Slug"
                placeholder="slug"
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
            Create Project
          </SubmitForm>
        </CardFooter>
      </Form>
    </FormCtx>
  );
};

export default CreateForm;
