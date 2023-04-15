"use client";

import React, {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  useImperativeHandle,
  useRef,
  type ComponentProps,
} from "react";
import { type ZodType } from "zod";
import { cn } from "@chia/utils/cn.util";
interface Props extends ComponentProps<"textarea"> {
  title?: string;
  error?: string;
  titleClassName?: string;
  errorClassName?: string;
  schema?: ZodType<any>;
}

interface TextAreaRef extends Partial<HTMLTextAreaElement> {
  isValid: () => boolean;
}

const Textarea = forwardRef<TextAreaRef, Props>((props, ref) => {
  const {
    title,
    error,
    titleClassName,
    schema,
    className,
    onChange,
    onBlur,
    onFocus,
    errorClassName,
    ...rest
  } = props;
  const [isError, setIsError] = useState(false);
  const [isFocus, setIsFocus] = useState(false);
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    isValid: () => {
      if (schema) return !isError;
      return true;
    },
    ...textareaRef.current,
  }));

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (schema) {
      const { value } = e.target;
      const isValid = schema.safeParse(value).success;
      setIsError(!isValid);
    }
    onChange && onChange(e);
  };

  const handleBlur = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocus(false);
    onBlur && onBlur(e);
  };

  const handleFocus = (e: FocusEvent<HTMLTextAreaElement>) => {
    setIsFocus(true);
    onFocus && onFocus(e);
  };

  return (
    <>
      <label className={titleClassName} htmlFor={`${id}-textarea`}>
        {title ?? ""}
      </label>
      <textarea
        ref={textareaRef}
        id={`${id}-textarea`}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "c-border-primary c-bg-primary w-full rounded-lg border border-[#CBD2D7] p-2 transition ease-in-out focus:outline-none",
          isError &&
            "border-danger hover:cursor-not-allowed dark:border-danger dark:hover:cursor-not-allowed",
          isFocus && !isError && "focus:border-info",
          className
        )}
        {...rest}
      />
      {isError && (
        <p className={cn("text-danger", errorClassName)}>{error ?? ""}</p>
      )}
    </>
  );
});

Textarea.displayName = "Input";

export { type TextAreaRef };
export default Textarea;
