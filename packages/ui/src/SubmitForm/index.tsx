"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@nextui-org/react";
import type { FC, ReactNode } from "react";

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
