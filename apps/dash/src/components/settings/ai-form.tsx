"use client";

import { useState, useId } from "react";

import {
  InputGroup,
  Form,
  TextField,
  FieldError,
  Label,
  Button,
  Chip,
  Fieldset,
  Spinner,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
  useQueryClient,
  experimental_streamedQuery as streamedQuery,
} from "@tanstack/react-query";
import {
  Eye,
  EyeOff,
  MessageCircleQuestionMark,
  MessageCircleWarning,
  CheckCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { KEY_PROBE_MODELS } from "@chia/ai/house-models";
import { KEY_LABELS } from "@chia/ai/provider";
import type { KeyId } from "@chia/ai/provider";
import type { ModelMessage } from "@chia/ai/types";
import SubmitForm from "@chia/ui/submit-form";

import { HonoRPCError } from "@/libs/service/error";
import {
  generateAIContent,
  getAIKeys,
  getSignedAIKey,
  revokeAIKey,
} from "@/resources/ai.resource";

const schema = z.object({
  aiApiKey: z.string().min(1, "API Key is required"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  provider: KeyId;
}

const keysQueryKey = ["ai-keys"] as const;

/** Sends one tiny prompt on the cheapest model that key reaches, so a saved key fails here instead of mid-edit. */
const CheckAIKeyStatus = ({ provider }: Props) => {
  const checkStreamResult = useQuery({
    queryKey: ["check-ai-key", provider],
    queryFn: streamedQuery({
      streamFn: () =>
        generateAIContent({
          model: { provider, id: KEY_PROBE_MODELS[provider] },
          messages: [
            {
              role: "user",
              content: "Hello, world!",
            },
          ] satisfies ModelMessage[],
          // ^^^ Hono RPC currently does not infer array of union types correctly
        }),
    }),
    enabled: false,
  });

  return (
    <Button
      variant={checkStreamResult.isError ? "danger-soft" : "tertiary"}
      size="sm"
      onPress={() => checkStreamResult.refetch()}
      isPending={checkStreamResult.isFetching}>
      {checkStreamResult.isFetching ? (
        <Spinner size="sm" />
      ) : checkStreamResult.isSuccess ? (
        <CheckCheck color="green" />
      ) : checkStreamResult.isError ? (
        <MessageCircleWarning color="red" />
      ) : (
        <MessageCircleQuestionMark />
      )}
      <span>Check Key</span>
    </Button>
  );
};

export const AIForm = ({ provider }: Props) => {
  const id = useId();
  const [show, setShow] = useState(false);
  const queryClient = useQueryClient();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const keys = useQuery({ queryKey: keysQueryKey, queryFn: getAIKeys });
  const isConfigured = keys.data?.configured.includes(provider) ?? false;
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: keysQueryKey });

  const save = useMutation({
    mutationFn: (data: FormData) => getSignedAIKey(data.aiApiKey, provider),
    onSuccess: async () => {
      form.reset({ aiApiKey: "" });
      toast.success("API Key saved successfully");
      await refresh();
    },
    onError: (error) => {
      if (error instanceof HonoRPCError) {
        toast.error(`Failed to save API Key: ${error.message}`);
      }
    },
  });

  const revoke = useMutation({
    mutationFn: () => revokeAIKey(provider),
    onSuccess: async () => {
      toast.success("API Key removed");
      await refresh();
    },
    onError: (error) => {
      if (error instanceof HonoRPCError) {
        toast.error(`Failed to remove API Key: ${error.message}`);
      }
    },
  });

  const handleSubmit = form.handleSubmit((data) => save.mutate(data));

  return (
    <Form onSubmit={handleSubmit} className="space-y-4">
      <Fieldset>
        <Fieldset.Group>
          <Controller
            control={form.control}
            name="aiApiKey"
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField isInvalid={invalid} isRequired variant="secondary">
                <Label
                  className="flex items-center gap-2"
                  htmlFor={`${id}-aiApiKey`}>
                  {KEY_LABELS[provider]} API Key
                  {isConfigured ? (
                    <Chip size="sm" variant="soft">
                      <Chip.Label className="text-xs">configured</Chip.Label>
                    </Chip>
                  ) : null}
                </Label>
                <InputGroup>
                  <InputGroup.Input
                    id={`${id}-aiApiKey`}
                    placeholder={
                      isConfigured
                        ? "Enter a new key to replace it"
                        : "Enter your API key"
                    }
                    type={show ? "text" : "password"}
                    {...field}
                  />
                  <InputGroup.Suffix className="gap-1">
                    <Button
                      size="sm"
                      isIconOnly
                      onPress={() => setShow(!show)}
                      variant="secondary">
                      {show ? <EyeOff /> : <Eye />}
                    </Button>
                  </InputGroup.Suffix>
                </InputGroup>
                <FieldError>{error?.message}</FieldError>
              </TextField>
            )}
          />
        </Fieldset.Group>

        <Fieldset.Actions className="flex w-full items-center gap-2">
          <SubmitForm size="sm" fullWidth>
            Save
          </SubmitForm>
          <CheckAIKeyStatus provider={provider} />
          {isConfigured ? (
            <Button
              isPending={revoke.isPending}
              onPress={() => revoke.mutate()}
              size="sm"
              variant="danger-soft">
              Revoke
            </Button>
          ) : null}
        </Fieldset.Actions>
      </Fieldset>
    </Form>
  );
};
