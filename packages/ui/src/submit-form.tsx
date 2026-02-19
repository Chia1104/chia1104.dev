"use client";

import type { FC, ReactNode } from "react";

import type { ButtonProps } from "@heroui/react";
import { Button } from "@heroui/react";
import { useFormStatus } from "react-dom";

interface Props extends Omit<ButtonProps, "children"> {
  children?: ReactNode | ((isPending: boolean) => ReactNode);
}

const SubmitForm: FC<Props> = ({ children, ...props }) => {
  const { pending } = useFormStatus();

  return (
    <Button isDisabled={pending} isPending={pending} type="submit" {...props}>
      {typeof children === "function" ? children(pending) : children}
    </Button>
  );
};

export default SubmitForm;
