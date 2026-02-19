"use client";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";

import {
  Input,
  Form,
  TextField,
  FieldError,
  Label,
  Card,
  Avatar,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { User2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";
import SubmitForm from "@chia/ui/submit-form";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.email().optional(),
  image: z.url().nullish(),
});

interface Props {
  defaultValues: Partial<Session["user"]>;
}

export const ProfileSetting = (props: Props) => {
  const router = useRouter();
  const id = useId();
  const [isPending, startTransition] = useTransition();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: props.defaultValues,
  });

  const handleSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      await authClient.updateUser(
        {
          name: values.name,
          image: values.image,
        },
        {
          onError: () => {
            toast.error("Failed to update profile");
          },
          onSuccess: () => {
            toast.success("Profile updated");
            router.refresh();
          },
        }
      );
    });
  });

  return (
    <Card className="w-full">
      <Card.Header>
        <Card.Title className="flex items-center gap-2">
          <User2 size={18} />
          Profile Settings
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <Form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <Controller
              control={form.control}
              name="image"
              render={({ field }) => (
                <Avatar>
                  <Avatar.Image src={field.value ?? ""} />
                  <Avatar.Fallback>
                    {field.value ? field.value.charAt(0).toUpperCase() : "U"}
                  </Avatar.Fallback>
                </Avatar>
              )}
            />
            <Controller
              control={form.control}
              name="name"
              render={({ field, fieldState: { invalid, error } }) => (
                <TextField isInvalid={invalid} isRequired variant="secondary">
                  <Label htmlFor={`${id}-name`}>Name</Label>
                  <Input
                    id={`${id}-name`}
                    placeholder="Enter your name"
                    {...field}
                  />
                  <FieldError>{error?.message}</FieldError>
                </TextField>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="email"
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField isInvalid={invalid} variant="secondary" isDisabled>
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  placeholder="Enter your email"
                  {...field}
                />
                <FieldError>{error?.message}</FieldError>
              </TextField>
            )}
          />

          <SubmitForm fullWidth className="mt-5" isPending={isPending}>
            Update Profile
          </SubmitForm>
        </Form>
      </Card.Content>
    </Card>
  );
};
