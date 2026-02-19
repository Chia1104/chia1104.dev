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

import { Provider } from "@chia/ai/types";
import type { Model, ModelMessage } from "@chia/ai/types";
import SubmitForm from "@chia/ui/submit-form";

import { HonoRPCError } from "@/libs/service/error";
import { getSignedAIKey, generateAIContent } from "@/resources/ai.resource";

const schema = z.object({
  aiApiKey: z.string().min(1, "API Key is required"),
  provider: z.enum(Provider).optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  model: Model;
}

const CheckAIKeyStatus = ({ model }: { model: Model }) => {
  const checkStreamResult = useQuery({
    queryKey: ["check-ai-key", model],
    queryFn: streamedQuery({
      streamFn: () =>
        generateAIContent({
          model: model,
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

export const AIForm = (props: Props) => {
  const id = useId();
  const [show, setShow] = useState(false);
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const { mutate } = useMutation({
    mutationFn: async (data: FormData) => {
      const signedKey = await getSignedAIKey(
        data.aiApiKey,
        data.provider ?? props.model.provider
      );
      return signedKey;
    },
    onSuccess: () => {
      toast.success("API Key saved successfully");
    },
    onError: (error) => {
      if (error instanceof HonoRPCError) {
        toast.error(`Failed to save API Key: ${error.message}`);
      }
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    mutate({
      aiApiKey: data.aiApiKey,
      provider: data.provider ?? props.model.provider,
    });
  });

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
                  {props.model.provider} API Key
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
          <CheckAIKeyStatus model={props.model} />
        </Fieldset.Actions>
      </Fieldset>
    </Form>
  );
};
