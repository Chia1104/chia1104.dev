"use client";

import {
  Fragment,
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type ComponentProps,
  useImperativeHandle,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { type ZodTypeAny } from "zod";
import { cn } from "../utils";
import { handleZodError } from "@chia/utils";

interface Props extends ComponentProps<"input"> {
  title?: string;
  /**
   * @deprecated use errorMessage instead
   */
  error?: string;
  titleClassName?: string;
  errorClassName?: string;
  schema?: ZodTypeAny;
  isValid?: boolean;
  /**
   * @deprecated use isDirty instead
   */
  firstTimeError?: boolean;
  isDirty?: boolean;
  errorMessage?: string | string[];
  onParse?: (
    value: string,
    isValid: boolean,
    message: string,
    multiMessage: string[]
  ) => void;
  prefixErrorMessage?: string;
  useMultiMessage?: boolean;
}

interface InputRef extends Partial<HTMLInputElement> {
  isValid: () => boolean;
}

const Input = forwardRef<InputRef, Props>((props, ref) => {
  const {
    title,
    titleClassName,
    schema,
    type = "text",
    value,
    className,
    onChange,
    errorClassName,
    isDirty = false,
    isValid,
    onParse,
    errorMessage,
    prefixErrorMessage,
    useMultiMessage,
    ...rest
  } = props;
  const [state, setState] = useState<{
    isValid: boolean;
    message: string;
    multiMessage: string[];
  }>({
    isValid: true,
    message: "",
    multiMessage: [],
  });
  const [valueState, setValueState] = useState(value ?? "");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    isValid: () => state.isValid,
    ...inputRef.current,
  }));

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const { value } = e.target;
      setValueState(value);
      if (schema) {
        handleZodError({
          schema,
          data: value,
          postParse: () => {
            setState({
              isValid: true,
              message: "",
              multiMessage: [],
            });
            onParse?.(e.target.value, true, "", []);
          },
          onError: (msg, issues) => {
            const multiMessage =
              errorMessage instanceof Array
                ? errorMessage
                : issues.map((issue) => issue.message);
            const message =
              typeof errorMessage === "string" ? errorMessage : msg;
            setState({
              isValid: false,
              message,
              multiMessage,
            });
            onParse?.(e.target.value, isValid ?? false, message, multiMessage);
          },
          prefixErrorMessage,
        });
      }
      onChange?.(e);
    },
    [schema, onChange, isValid, errorMessage, prefixErrorMessage, onParse]
  );

  const [isError, message, multiMessage] = useMemo(() => {
    const msg = typeof errorMessage === "string" ? errorMessage : state.message;
    const multiMsg =
      errorMessage instanceof Array ? errorMessage : state.multiMessage;
    const isError = !isValid ?? !state.isValid;
    return [isError, msg, multiMsg];
  }, [errorMessage, state.message, state.multiMessage, isValid, state.isValid]);

  return (
    <>
      {title && (
        <label className={titleClassName} htmlFor={`${id}-input`}>
          {title}
        </label>
      )}
      <input
        ref={inputRef}
        id={`${id}-input`}
        onChange={handleChange}
        value={valueState}
        type={type}
        className={cn(
          "dark:bg-dark/90 text-dark disable:border-danger w-full rounded border bg-white/90 p-2 backdrop-blur-sm transition ease-in-out focus:shadow-md focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white",
          isError
            ? "border-danger focus:shadow-danger/40"
            : "focus:border-secondary focus:shadow-secondary/40 dark:focus:border-primary dark:focus:shadow-primary/40 dark:border-slate-700",
          className
        )}
        {...rest}
      />
      {isError && (
        <>
          {useMultiMessage ? (
            multiMessage.map((message, index) => (
              <Fragment key={message}>
                <p className={cn("text-danger", errorClassName)}>
                  {message ?? ""}
                </p>
                {index !== state.multiMessage.length - 1 && ", "}
              </Fragment>
            ))
          ) : (
            <p className={cn("text-danger", errorClassName)}>{message ?? ""}</p>
          )}
        </>
      )}
    </>
  );
});

Input.displayName = "Input";

export { type InputRef };
export default Input;
