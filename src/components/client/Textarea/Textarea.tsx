import React, {
  forwardRef,
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type DetailedHTMLProps,
  type TextareaHTMLAttributes,
  useImperativeHandle,
  useRef,
} from "react";
import { ZodType } from "zod";
import cx from "classnames";

interface Props
  extends DetailedHTMLProps<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    HTMLTextAreaElement
  > {
  title?: string;
  error?: string;
  titleClassName?: string;
  errorClassName?: string;
  schema?: ZodType<any>;
}

interface TextAreaRef {
  getValidity: () => boolean;
  getNativeInput: () => HTMLTextAreaElement;
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
    getValidity: () => {
      if (schema) return !isError;
      return true;
    },
    getNativeInput: () => {
      return textareaRef.current as HTMLTextAreaElement;
    },
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
        className={cx(
          "border-[#CBD2D7] w-full rounded-lg c-border-primary transition ease-in-out focus:outline-none c-bg-primary p-2",
          isError &&
            "border-danger hover:cursor-not-allowed dark:border-danger dark:hover:cursor-not-allowed",
          isFocus && !isError && "focus:border-info",
          className
        )}
        {...rest}
      />
      {isError && (
        <p className={cx("text-danger", errorClassName)}>{error ?? ""}</p>
      )}
    </>
  );
});

Textarea.displayName = "Input";

export { type TextAreaRef };
export default Textarea;
