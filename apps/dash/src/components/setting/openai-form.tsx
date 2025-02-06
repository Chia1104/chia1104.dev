"use client";

import { useState } from "react";

import { Input, Button, Divider } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { OpenAIModal } from "@chia/ai/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";
import { cn } from "@chia/ui/utils/cn.util";
import type { ErrorResponse } from "@chia/utils";
import { serviceRequest } from "@chia/utils";

const openaiApiKeySchema = z.object({
  apiKey: z.string().min(1),
});

type SaveOpenaiApiKeyDTO = z.infer<typeof openaiApiKeySchema>;

const OpenaiForm = () => {
  const [show, setShow] = useState(false);
  const form = useForm<SaveOpenaiApiKeyDTO>({
    defaultValues: {
      apiKey: "",
    },
    resolver: zodResolver(openaiApiKeySchema),
  });

  const saveApiKey = useMutation<any, Error, SaveOpenaiApiKeyDTO>({
    mutationFn: async (dto) =>
      serviceRequest().post("ai/key:signed", {
        json: dto,
      }),
    onSuccess: () => {
      toast.success("API key saved successfully");
    },
    onError: () => {
      toast.error("Failed to save API key");
    },
  });

  const checkApiKey = useMutation({
    mutationFn: async () =>
      await serviceRequest().post("ai/generate", {
        json: {
          modal: OpenAIModal["gpt-3.5-turbo"],
          messages: [{ role: "user", content: "Hello, AI!" }],
        },
      }),
    onError: async (err) => {
      if (err instanceof HTTPError) {
        const error = await err.response?.json<ErrorResponse>();
        toast.error(error.errors?.[0].message ?? "Failed to check API key");
        return;
      }
      toast.error("Failed to check API key");
    },
    onSuccess: () => toast.success("API key is valid"),
  });

  const onSubmit = form.handleSubmit((values) => {
    saveApiKey.mutate({
      apiKey: values.apiKey,
    });
  });
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="w-full flex flex-col gap-5">
        <FormField<SaveOpenaiApiKeyDTO, "apiKey">
          control={form.control}
          name="apiKey"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <Input
                  label="Openai API Key"
                  labelPlacement="outside"
                  placeholder="API Key"
                  isInvalid={fieldState.invalid}
                  endContent={
                    <Button
                      isIconOnly
                      variant="light"
                      onClick={() => setShow(!show)}>
                      {show ? <EyeOff /> : <Eye />}
                    </Button>
                  }
                  type={show ? "text" : "password"}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-fit"
          isLoading={saveApiKey.isPending}>
          Save
        </Button>
        <Divider className="w-full" />
        <div className="w-full flex justify-between items-center">
          <label className={cn("text-sm text-gray-500")}>
            Check the API key
          </label>
          <Button
            color={checkApiKey.isError ? "danger" : "default"}
            isLoading={checkApiKey.isPending}
            onPress={() => checkApiKey.mutate()}>
            Check
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default OpenaiForm;
