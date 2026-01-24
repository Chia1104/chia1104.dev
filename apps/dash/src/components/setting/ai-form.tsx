"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";

import { Input, Button } from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { HTTPError } from "ky";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import * as z from "zod";

import type { Model } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Form,
} from "@chia/ui/form";
import { cn } from "@chia/ui/utils/cn.util";
import type { ErrorResponse } from "@chia/utils/request";
import { serviceRequest } from "@chia/utils/request";

const openaiApiKeySchema = z.object({
  apiKey: z.string().min(1),
  provider: z.enum(Provider).optional(),
});

type SaveOpenaiApiKeyDTO = z.infer<typeof openaiApiKeySchema>;

interface Props {
  model: Model;
}

const AiForm = ({ model }: Props) => {
  const [show, setShow] = useState(false);
  const form = useForm<SaveOpenaiApiKeyDTO>({
    defaultValues: {
      apiKey: "",
      provider: model.provider,
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
          model,
          messages: [{ role: "user", content: "Hello, AI!" }],
        },
      }),
    onError: async (err) => {
      if (err instanceof HTTPError) {
        const error = await err.response?.json<ErrorResponse>();
        toast.error(error.errors?.[0]?.message ?? "Failed to check API key");
        return;
      }
      toast.error("Failed to check API key");
    },
    onSuccess: () => toast.success("API key is valid"),
  });

  const onSubmit = form.handleSubmit((values) => {
    saveApiKey.mutate(values);
  });
  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
        <FormField<SaveOpenaiApiKeyDTO, "apiKey">
          control={form.control}
          name="apiKey"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormControl>
                <Input
                  label="API Key"
                  labelPlacement="outside"
                  placeholder="API Key"
                  isInvalid={fieldState.invalid}
                  endContent={
                    <Button
                      isIconOnly
                      variant="light"
                      onPress={() => setShow(!show)}>
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
        <div className="flex w-full items-center justify-between">
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

export default AiForm;
