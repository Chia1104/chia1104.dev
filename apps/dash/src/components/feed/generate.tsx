import { Button, Tooltip } from "@heroui/react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@chia/ui/utils/cn.util";

import {
  useGenerateFeedSlug,
  useGenerateFeedDescription,
  useGenerateFeedContent,
} from "@/services/ai/hooks";

export const GenerateFeedSlug = ({
  title,
  onSuccess,
  preGenerate,
}: {
  title: string;
  onSuccess?: (data: string) => void;
  preGenerate?: () => void;
}) => {
  const generate = useGenerateFeedSlug(
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
    <Tooltip content="Generate Feed Slug based on the title">
      <Button
        isLoading={generate.isLoading}
        size="sm"
        variant="flat"
        color="primary"
        isIconOnly
        onPress={() => {
          preGenerate?.();
          generate.complete(`My current title is ${title}`);
        }}>
        <Sparkles className="size-4" />
      </Button>
    </Tooltip>
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
  const generate = useGenerateFeedDescription(input, {
    onError: (error) => {
      console.error(error);
      toast.error("Failed to generate feed description");
    },
    onFinish(prompt, completion: string) {
      if (completion) {
        onSuccess?.(completion);
      }
    },
  });

  return (
    <Tooltip content="Generate Feed Description based on the title">
      <Button
        isLoading={generate.isLoading}
        size="sm"
        variant="flat"
        color="primary"
        isIconOnly
        onPress={() => {
          preGenerate?.();
          generate.complete(`My current title is ${input}`);
        }}>
        <Sparkles className="size-4" />
      </Button>
    </Tooltip>
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
  const generate = useGenerateFeedContent(input, {
    onError: (error) => {
      console.error(error);
      toast.error("Failed to generate feed content");
    },
    onFinish(prompt, completion: string) {
      if (completion) {
        onSuccess?.(completion);
      }
    },
  });

  return (
    <Tooltip content="Generate Feed Content based on the previously content">
      <Button
        isLoading={generate.isLoading}
        size="sm"
        variant="flat"
        color="primary"
        className={cn(className)}
        isIconOnly
        onPress={() =>
          generate.complete(`My current input is ${input.content}`)
        }>
        <Sparkles className="size-4" />
      </Button>
    </Tooltip>
  );
};
