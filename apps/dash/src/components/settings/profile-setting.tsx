"use client";
import { useRouter } from "next/navigation";
import { useId } from "react";

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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { User2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import type { Session } from "@chia/services/auth/auth.contract";
import SubmitForm from "@chia/ui/submit-form";

import { orpc } from "@/libs/orpc/client";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(50),
  email: z.email().nullish(),
  image: z.url().nullish(),
});

interface Props {
  defaultValues: Partial<Session["user"]>;
}

export const ProfileSetting = (props: Props) => {
  const router = useRouter();
  const id = useId();
  const queryClient = useQueryClient();
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: props.defaultValues,
  });
  const update = useMutation(
    orpc.user.updateProfile.mutationOptions({
      onError: () => {
        toast.error("Failed to update profile");
      },
      onSuccess: async () => {
        toast.success("Profile updated");
        await queryClient.invalidateQueries({
          queryKey: orpc.auth.session.key(),
        });
        router.refresh();
      },
    })
  );

  const handleSubmit = form.handleSubmit((values) => {
    update.mutate({ name: values.name, image: values.image ?? null });
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
        <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                  value={field.value ?? ""}
                />
                <FieldError>{error?.message}</FieldError>
              </TextField>
            )}
          />

          <SubmitForm
            className="self-end"
            isPending={update.isPending}
            size="sm">
            Update Profile
          </SubmitForm>
        </Form>
      </Card.Content>
    </Card>
  );
};
