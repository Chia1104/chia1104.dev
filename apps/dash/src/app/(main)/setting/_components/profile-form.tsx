"use client";

import {
  CardHeader,
  Card,
  Avatar,
  Button,
  CardBody,
  Input,
} from "@nextui-org/react";
import { useSession } from "next-auth/react";
import { useForm } from "react-hook-form";

import type { Session } from "@chia/auth-core/types";
import { FormControl, FormField, FormItem, FormMessage, Form } from "@chia/ui";

const UserProfileForm = () => {
  const session = useSession();
  const form = useForm<Session["user"]>({
    defaultValues: {
      image: session.data?.user.image,
      name: session.data?.user.name,
      email: session.data?.user.email,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    console.log(values);
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
            <Button type="submit" className="w-fit" disabled>
              Save
            </Button>
          </CardBody>
        </Card>
      </form>
    </Form>
  );
};

export default UserProfileForm;
