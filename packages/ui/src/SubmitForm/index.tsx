"use client";

import type { FC, ReactNode } from "react";

import { Button } from "@nextui-org/react";
import type { ButtonProps } from "@nextui-org/react";
import { useFormStatus } from "react-dom";

interface Props extends Omit<ButtonProps, "children"> {
  children: ReactNode | ((isPending: boolean) => ReactNode);
}

const SubmitForm: FC<Props> = ({ children, ...props }) => {
  const { pending } = useFormStatus();

  return (
    <Button disabled={pending} isLoading={pending} type="submit" {...props}>
      {typeof children === "function" ? children(pending) : children}
    </Button>
  );
};

export default SubmitForm;
