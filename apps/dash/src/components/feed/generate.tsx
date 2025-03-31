import { toast } from "sonner";

import { cn } from "@chia/ui/utils/cn.util";

import {
  useGenerateFeedSlug,
  useGenerateFeedDescription,
  useGenerateFeedContent,
} from "@/services/ai/hooks";
import { useAIStore } from "@/store/ai.store";

import { Modal } from "../ai/modal";

export const GenerateFeedSlug = ({
  title,
  onSuccess,
  preGenerate,
}: {
  title: string;
  onSuccess?: (data: string) => void;
  preGenerate?: () => void;
}) => {
  const action = useAIStore((state) => state);
  const generate = useGenerateFeedSlug(
    action.getModal("feed-slug"),
    { title },
    {
      onError: (error) => {
        console.error(error);
        toast.error("Failed to generate feed slug");
      },
      onFinish(prompt, completion: string) {
        if (completion) {
          onSuccess?.(completion);
        }
      },
    }
  );

  return (
    <Modal
      isLoading={generate.isLoading}
      size="sm"
      variant="flat"
      color="primary"
      workspace="feed-slug"
      onAction={() => {
        preGenerate?.();
        void generate.complete(`My current title is ${title}`);
      }}
    />
  );
};

export const GenerateFeedDescription = ({
  input,
  onSuccess,
  preGenerate,
}: {
  input: string;
  onSuccess?: (data: string) => void;
  preGenerate?: () => void;
}) => {
  const action = useAIStore((state) => state);
  const generate = useGenerateFeedDescription(
    action.getModal("feed-description"),
    input,
    {
      onError: (error) => {
        console.error(error);
        toast.error("Failed to generate feed description");
      },
      onFinish(prompt, completion: string) {
        if (completion) {
          onSuccess?.(completion);
        }
      },
    }
  );

  return (
    <Modal
      isLoading={generate.isLoading}
      size="sm"
      variant="flat"
      color="primary"
      workspace="feed-description"
      isIconOnly
      onAction={() => {
        preGenerate?.();
        void generate.complete(`My current title is ${input}`);
      }}
    />
  );
};

export const GenerateFeedContent = ({
  input,
  onSuccess,
  className,
}: {
  input: { title?: string; description?: string; content: string };
  onSuccess?: (data: string) => void;
  className?: string;
}) => {
  const action = useAIStore((state) => state);
  const generate = useGenerateFeedContent(
    action.getModal("feed-content"),
    input,
    {
      onError: (error) => {
        console.error(error);
        toast.error("Failed to generate feed content");
      },
      onFinish(prompt, completion: string) {
        if (completion) {
          onSuccess?.(completion);
        }
      },
    }
  );

  return (
    <Modal
      workspace="feed-content"
      isLoading={generate.isLoading}
      size="sm"
      variant="flat"
      color="primary"
      className={cn(className)}
      isIconOnly
      onAction={() => generate.complete(`My current input is ${input.content}`)}
    />
  );
};
