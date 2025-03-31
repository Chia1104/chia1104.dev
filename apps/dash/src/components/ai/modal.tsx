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
} from "@heroui/react";
import { ChevronDownIcon } from "lucide-react";

import type { Modal as TModal } from "@chia/ai/types";
import { Provider } from "@chia/ai/types";
import useDarkMode from "@chia/ui/utils/use-theme";

import type { Workspace } from "@/store/ai.store";
import { useAIStore } from "@/store/ai.store";

import Anthropic from "../icon/anthropic";
import AnthropicLight from "../icon/anthropic.light";
import Gemini from "../icon/gemini";
import OpenAI from "../icon/openai";
import OpenAILight from "../icon/openai.light";

interface Props {
  workspace: Workspace;
  onAction: (modal: TModal) => void;
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
    default:
      return isDarkMode ? <OpenAI /> : <OpenAILight />;
  }
};

export const Modal = ({
  workspace,
  onAction,
  ...props
}: Props & Omit<ButtonProps, "onPress">) => {
  const action = useAIStore((state) => state);
  const options = useAIStore((state) => state.options);

  const handlePress = () => {
    onAction(action.getModal(workspace));
  };

  return (
    <ButtonGroup
      size="sm"
      variant="flat"
      color="primary"
      isDisabled={props.isDisabled || props.isLoading}>
      <Button isIconOnly onPress={handlePress} aria-label="AI Model" {...props}>
        <Icon provider={action.getModal(workspace).provider} />
      </Button>
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
              selectedKeys={new Set([action.getModal(workspace).id])}
              selectionMode="single"
              onSelectionChange={(keys) => {
                const selectedOption = options.find((option) =>
                  (keys as Set<string>).has(option.id)
                );
                if (selectedOption) {
                  action.setModal(workspace, selectedOption);
                }
              }}>
              {options.map((option) => (
                <MenuItem key={option.id} description={option.provider}>
                  <span className="flex items-center gap-2">
                    <Icon provider={option.provider} />
                    {option.name}
                  </span>
                </MenuItem>
              ))}
            </Menu>
          </ScrollShadow>
        </PopoverContent>
      </Popover>
    </ButtonGroup>
  );
};
