"use client";

import { useState } from "react";

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

import { authClient } from "@chia/auth/client";
import type { Session } from "@chia/auth/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";

const UserProfileForm = (props: {
  defaultValues: Partial<Session["user"]>;
}) => {
  const form = useForm<Partial<Session["user"]>>({
    defaultValues: props.defaultValues,
  });
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  const onSubmit = form.handleSubmit((values) => {
    void authClient.updateUser(
      {
        name: values.name,
        image: values.image,
      },
      {
        onError: () => {
          toast.error("Failed to update profile");
          setIsPending(false);
        },
        onSuccess: () => {
          toast.success("Profile updated");
          setIsPending(false);
          router.refresh();
        },
        onRequest: () => {
          setIsPending(true);
        },
      }
    );
  });

  return (
    <section className="w-full flex flex-col gap-5">
      <Card>
        <Form {...form}>
          <form onSubmit={onSubmit}>
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
                        disabled={isPending}
                        placeholder="Name"
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
                isLoading={isPending}
                type="submit"
                className="w-fit mt-5">
                Save
              </Button>
            </CardBody>
          </form>
        </Form>
      </Card>
    </section>
  );
};

export default UserProfileForm;
