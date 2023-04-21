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
import { cn } from "../utils/cn.util.ts";

interface Props extends ComponentProps<"input"> {
  title?: string;
  error?: string;
  titleClassName?: string;
  errorClassName?: string;
  schema?: ZodType<any>;
}

interface InputRef extends Partial<HTMLInputElement> {
  isValid: () => boolean;
}

const Input = forwardRef<InputRef, Props>((props, ref) => {
  const {
    title,
    error,
    titleClassName,
    schema,
    type = "text",
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
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    isValid: () => {
      if (schema) return !isError;
      return true;
    },
    ...inputRef.current,
  }));

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (schema) {
      const { value } = e.target;
      const isValid = schema.safeParse(value).success;
      setIsError(!isValid);
    }
    onChange && onChange(e);
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocus(false);
    onBlur && onBlur(e);
  };

  const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
    setIsFocus(true);
    onFocus && onFocus(e);
  };

  return (
    <>
      <label className={titleClassName} htmlFor={`${id}-input`}>
        {title ?? ""}
      </label>
      <input
        ref={inputRef}
        id={`${id}-input`}
        onChange={handleChange}
        type={type}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cn(
          "c-border-primary c-bg-primary w-full rounded-lg border border-[#CBD2D7] p-1 transition ease-in-out focus:outline-none",
          isError &&
            "border-danger dark:border-danger hover:cursor-not-allowed dark:hover:cursor-not-allowed",
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

Input.displayName = "Input";

export { type InputRef };
export default Input;
