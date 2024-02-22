import { type ComponentPropsWithoutRef, type FC } from "react";
import { Button as InternalButton, cn } from "@chia/ui";

const Button: FC<ComponentPropsWithoutRef<"button">> = ({
  className,
  ...props
}) => {
  return <InternalButton className={cn("", className)} {...props} />;
};

export default Button;
