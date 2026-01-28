"use client";

import { useId } from "react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";

import { Input, Form, TextField, FieldError, Label } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import SubmitForm from "@chia/ui/submit-form";

const schema = z.object({
  name: z.string().min(2).max(50),
  slug: z.string().min(2).max(50),
  logo: z.string().nullish(),
});

export type FormData = z.infer<typeof schema>;

interface Props {
  onSubmit?: (data: FormData) => void;
  defaultValues?: Partial<FormData>;
}

export const EditForm = (props: Props) => {
  const id = useId();
  const form = useForm<FormData>({
    defaultValues: props.defaultValues,
    resolver: zodResolver(schema),
  });

  const handleSubmit = form.handleSubmit((data) => {
    props?.onSubmit?.(data);
  });

  return (
    <Form onSubmit={handleSubmit} className="w-full space-y-4">
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
        Save Project
      </SubmitForm>
    </Form>
  );
};
