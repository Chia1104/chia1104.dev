import type { FC, ComponentPropsWithoutRef } from "react";

import { cn } from "../utils/cn.util";

const RetroGrid: FC<ComponentPropsWithoutRef<"div">> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn(
        "absolute h-full w-full overflow-hidden perspective-[200px]",
        className
      )}
      {...props}>
      <div className="absolute inset-0 transform-[rotateX(45deg)]">
        <div
          className={cn(
            "animate-cia-grid opacity-30",
            "inset-[0%_0px] ml-[-50%] h-screen w-[200vw] origin-[100%_0_0] bg-size-[60px_60px] bg-repeat",
            "bg-[linear-gradient(to_right,rgba(0,0,0,0.1)_1px,transparent_0),linear-gradient(to_bottom,rgba(0,0,0,0.1)_1px,transparent_0)]",
            "dark:bg-[linear-gradient(to_right,rgba(255,255,255,0.1)_1px,transparent_0),linear-gradient(to_bottom,rgba(255,255,255,0.1)_1px,transparent_0)]"
          )}
        />
      </div>
      {children}
    </div>
  );
};

export default RetroGrid;
