"use client";

import { useState, useId } from "react";

import {
  InputGroup,
  Form,
  TextField,
  FieldError,
  Label,
  Button,
  Fieldset,
  Spinner,
} from "@heroui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useMutation,
  useQuery,
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
import { PROVIDER_LABELS } from "@chia/ai/provider";
import type { ProviderId } from "@chia/ai/provider";
import type { ModelMessage } from "@chia/ai/types";
import SubmitForm from "@chia/ui/submit-form";

import { HonoRPCError } from "@/libs/service/error";
import { getSignedAIKey, generateAIContent } from "@/resources/ai.resource";

const schema = z.object({
  aiApiKey: z.string().min(1, "API Key is required"),
});

type FormData = z.infer<typeof schema>;

interface Props {
  provider: ProviderId;
}

/** Sends one tiny prompt on the cheapest native model, so a saved key fails here instead of mid-edit. */
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
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { mutate } = useMutation({
    mutationFn: (data: FormData) => getSignedAIKey(data.aiApiKey, provider),
    onSuccess: () => {
      toast.success("API Key saved successfully");
    },
    onError: (error) => {
      if (error instanceof HonoRPCError) {
        toast.error(`Failed to save API Key: ${error.message}`);
      }
    },
  });

  const handleSubmit = form.handleSubmit((data) => mutate(data));

  return (
    <Form onSubmit={handleSubmit} className="space-y-4">
      <Fieldset>
        <Fieldset.Group>
          <Controller
            control={form.control}
            name="aiApiKey"
            render={({ field, fieldState: { invalid, error } }) => (
              <TextField isInvalid={invalid} isRequired variant="secondary">
                <Label htmlFor={`${id}-aiApiKey`}>
                  {PROVIDER_LABELS[provider]} API Key
                </Label>
                <InputGroup>
                  <InputGroup.Input
                    id={`${id}-aiApiKey`}
                    placeholder="Enter your API key"
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

        <Fieldset.Actions className="flex w-full items-center">
          <SubmitForm size="sm" fullWidth>
            Save
          </SubmitForm>
          <CheckAIKeyStatus provider={provider} />
        </Fieldset.Actions>
      </Fieldset>
    </Form>
  );
};
