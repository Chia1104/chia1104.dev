"use client";

import type { ButtonProps } from "@heroui/react";
import {
  Button,
  ButtonGroup,
  Menu,
  MenuItem,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollShadow,
  Tooltip,
  Chip,
} from "@heroui/react";
import { ChevronDownIcon, Eye, FileText, Brain, Globe } from "lucide-react";

import type { Model as TModel } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import useDarkMode from "@chia/ui/utils/use-theme";

import type { ModelFeatures } from "@/store/ai.store";
import type { Workspace } from "@/store/ai.store";
import { useAIStore } from "@/store/ai.store";

import Anthropic from "../icon/anthropic";
import AnthropicLight from "../icon/anthropic.light";
import DeepSeek from "../icon/deep-seek";
import Gemini from "../icon/gemini";
import OpenAI from "../icon/openai";
import OpenAILight from "../icon/openai.light";

interface Props {
  workspace: Workspace;
  onAction: (modal: TModel) => void;
}

const Icon = ({ provider }: { provider: Provider }) => {
  const { isDarkMode } = useDarkMode();
  switch (provider) {
    case Provider.OpenAI:
      return isDarkMode ? <OpenAI /> : <OpenAILight />;
    case Provider.Anthropic:
      return isDarkMode ? <Anthropic /> : <AnthropicLight />;
    case Provider.Google:
      return <Gemini />;
    case Provider.DeepSeek:
      return <DeepSeek />;
    default:
      return isDarkMode ? <OpenAI /> : <OpenAILight />;
  }
};

const FeaturesList = ({ features }: { features?: ModelFeatures }) => {
  if (!features) return null;
  return (
    <div className="flex items-center gap-2">
      {features.reasoning && (
        <Tooltip content="Reasoning">
          <Chip color="primary" variant="flat" size="sm" aria-label="Reasoning">
            <Brain size={12} />
          </Chip>
        </Tooltip>
      )}
      {features.image && (
        <Tooltip content="Image">
          <Chip color="secondary" variant="flat" size="sm" aria-label="Image">
            <Eye size={12} />
          </Chip>
        </Tooltip>
      )}
      {features.pdf && (
        <Tooltip content="PDF">
          <Chip color="warning" variant="flat" size="sm" aria-label="PDF">
            <FileText size={12} />
          </Chip>
        </Tooltip>
      )}
      {features.search && (
        <Tooltip content="Search">
          <Chip color="success" variant="flat" size="sm" aria-label="Search">
            <Globe size={12} />
          </Chip>
        </Tooltip>
      )}
    </div>
  );
};

export const Model = ({
  workspace,
  onAction,
  ...props
}: Props & Omit<ButtonProps, "onPress">) => {
  const action = useAIStore((state) => state);
  const options = useAIStore((state) => state.options);

  const handlePress = () => {
    onAction(action.getModel(workspace));
  };

  return (
    <ButtonGroup
      size="sm"
      variant="flat"
      color="primary"
      isDisabled={props.isDisabled || props.isLoading}>
      <Tooltip content={action.getModel(workspace).id}>
        <Button
          isIconOnly
          onPress={handlePress}
          aria-label="AI Model"
          {...props}>
          <Icon provider={action.getModel(workspace).provider} />
        </Button>
      </Tooltip>
      <Popover placement="bottom-end">
        <PopoverTrigger>
          <Button isIconOnly aria-label="AI Model">
            <ChevronDownIcon size={16} />
          </Button>
        </PopoverTrigger>
        <PopoverContent>
          <ScrollShadow className="h-[300px]">
            <Menu
              disallowEmptySelection
              aria-label="AI Model"
              className="max-w-[300px]"
              selectedKeys={new Set([action.getModel(workspace).id])}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const selectedOption = options.find((option) =>
                  (keys as Set<string>).has(option.id)
                );
                if (selectedOption) {
                  action.setModel(workspace, selectedOption);
                }
              }}
              disabledKeys={options
                .filter((option) => !option.enabled)
                .map((option) => option.id)}>
              {options.map((option) => (
                <MenuItem
                  key={option.id}
                  classNames={{
                    wrapper: "gap-2",
                  }}
                  description={<FeaturesList features={option.features} />}
                  title={
                    <span className="flex items-center gap-2">
                      <Icon provider={option.provider} />
                      {option.name}
                    </span>
                  }
                  isReadOnly={!option.enabled}
                  aria-label={option.name}
                />
              ))}
            </Menu>
          </ScrollShadow>
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  );
};
