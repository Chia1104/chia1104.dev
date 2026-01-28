"use client";

import { useRouter } from "next/navigation";
import { useId } from "react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Input, Form, TextField, FieldError, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import * as z from "zod";

import type { Organization } from "@chia/auth/types";
import SubmitForm from "@chia/ui/submit-form";

import { orpc } from "@/libs/orpc/client";
import { setCurrentOrg } from "@/server/org.action";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  slug: z.string().min(2, "Slug must be at least 2 characters").max(50),
  logo: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface OnboardingFormProps {
  onSuccess?: (data: Organization) => void;
}

export function OnboardingForm({ onSuccess }: OnboardingFormProps) {
  const router = useRouter();
  const id = useId();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      slug: "",
      logo: "",
    },
  });

  const { mutate } = useMutation(
    orpc.organization.create.mutationOptions({
      onSuccess: async (data) => {
        if (data.slug) {
          await setCurrentOrg(data.slug);
          router.push("/");
          onSuccess?.(data);
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
    <Form onSubmit={handleSubmit} className="space-y-4">
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} isRequired variant="secondary">
            <Label htmlFor={`${id}-name`}>Organization Name</Label>
            <Input
              id={`${id}-name`}
              placeholder="Enter your organization name"
              {...field}
            />
            <FieldError>{error?.message}</FieldError>
          </TextField>
        )}
      />

      <Controller
        control={form.control}
        name="slug"
        render={({ field, fieldState: { invalid, error } }) => (
          <TextField isInvalid={invalid} isRequired variant="secondary">
            <Label htmlFor={`${id}-slug`}>URL Slug</Label>
            <Input id={`${id}-slug`} placeholder="slug" {...field} />
            <FieldError>{error?.message}</FieldError>
          </TextField>
        )}
      />

      <SubmitForm fullWidth className="mt-5">
        Create Organization
      </SubmitForm>
    </Form>
  );
}
