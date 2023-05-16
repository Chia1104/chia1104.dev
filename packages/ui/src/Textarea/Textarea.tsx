import React, {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type ComponentProps,
  useImperativeHandle,
  useRef,
  useCallback,
} from "react";
import { ZodType } from "zod";
import { cn } from "../utils";

interface Props extends ComponentProps<"textarea"> {
  title?: string;
  error?: string;
  titleClassName?: string;
  errorClassName?: string;
  schema?: ZodType<any>;
  isValid?: boolean;
  firstTimeError?: boolean;
}

interface TextareaRef extends Partial<HTMLTextAreaElement> {
  isValid: () => boolean;
}

const Textarea = forwardRef<TextareaRef, Props>((props, ref) => {
  const {
    title,
    error,
    titleClassName,
    schema,
    value,
    className,
    onChange,
    errorClassName,
    isValid: isValidProp = false,
    firstTimeError: firstTimeErrorProp = false,
    ...rest
  } = props;
  const [isValid, setIsValid] = useState<boolean>(isValidProp);
  const [isFirstRender, setIsFirstRender] = useState<boolean>(
    !firstTimeErrorProp
  );
  const [valueState, setValueState] = useState(value ?? "");
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    isValid: () => {
      if (schema) return isValid;
      return true;
    },
    ...textareaRef.current,
  }));

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const { value } = e.target;
      setValueState(value);
      setIsFirstRender(false);
      if (schema) {
        setIsValid(schema.safeParse(value).success);
      }
      onChange && onChange(e);
    },
    [schema, onChange, setIsValid, setValueState, setIsFirstRender]
  );

  return (
    <>
      {title && (
        <label className={titleClassName} htmlFor={`${id}-textarea`}>
          {title}
        </label>
      )}
      <textarea
        ref={textareaRef}
        id={`${id}-textarea`}
        onChange={handleChange}
        value={valueState}
        className={cn(
          "dark:bg-dark/90 text-dark disable:border-danger w-full rounded border bg-white/90 p-2 backdrop-blur-sm transition ease-in-out focus:shadow-md focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:text-white",
          !isFirstRender && !isValid
            ? "border-danger focus:shadow-danger/40"
            : "focus:border-secondary focus:shadow-secondary/40 dark:focus:border-primary dark:focus:shadow-primary/40 dark:border-slate-700",
          className
        )}
        {...rest}
      />
      {!isFirstRender && !isValid && error && (
        <p className={cn("text-danger", errorClassName)}>{error ?? ""}</p>
      )}
    </>
  );
});

Textarea.displayName = "Input";

export { type TextareaRef };
export default Textarea;
