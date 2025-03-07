"use client";

import {
  Input,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  Divider,
  Form,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Form as FormCtx, FormField } from "@chia/ui/form";
import SubmitForm from "@chia/ui/submit-form";

import { api } from "@/trpc/client";

const schema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  logo: z.string().optional(),
});

const Page = () => {
  const router = useRouter();
  const form = useForm({
    resolver: zodResolver(schema),
  });

  const { mutate } = api.organization.createOrganization.useMutation({
    onSuccess: (data) => {
      if (data) {
        void router.push(`/${data.slug}`);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    mutate(data);
  });

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
      </Card>
    </div>
  );
};

export default Page;
