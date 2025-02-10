"use client";

import {
  CardHeader,
  Card,
  Avatar,
  Button,
  CardBody,
  Input,
} from "@heroui/react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import type { Session } from "@chia/auth/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";

import { api } from "@/trpc/client";

const UserProfileForm = (props: {
  defaultValues: Partial<Session["user"]>;
}) => {
  const form = useForm<Partial<Session["user"]>>({
    defaultValues: props.defaultValues,
  });

  const router = useRouter();

  const utils = api.useUtils();

  const updateProfile = api.users.updateUserProfile.useMutation({
    onError: () => toast.error("Failed to update profile"),
    onSuccess: async () => {
      toast.success("Profile updated");
      router.refresh();
      await utils.users.invalidate();
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    updateProfile.mutate({
      id: props.defaultValues.id ?? "",
      name: values.name,
      image: values.image,
    });
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-5">
        <Card>
          <CardHeader className="gap-5">
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Avatar src={field.value ?? ""} size="lg" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      placeholder="Name"
                      disabled={updateProfile.isPending}
                      {...field}
                      value={field.value ?? undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardHeader>
          <CardBody>
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      label="Email"
                      placeholder="Email"
                      disabled
                      {...field}
                      value={field.value ?? undefined}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-fit mt-5"
              isLoading={updateProfile.isPending}>
              Save
            </Button>
          </CardBody>
        </Card>
      </form>
    </Form>
  );
};

export default UserProfileForm;
