"use client";

import {
  type FC,
  type DetailedHTMLProps,
  type IframeHTMLAttributes,
} from "react";

interface MDXCodeSandBoxProps
  extends DetailedHTMLProps<
    IframeHTMLAttributes<HTMLIFrameElement>,
    HTMLIFrameElement
  > {
  codeSrc: string;
}

const MDXCodeSandBox: FC<MDXCodeSandBoxProps> = (props) => {
  const { codeSrc, ...rest } = props;
  return (
    <div>
      <iframe
        src={codeSrc}
        loading="lazy"
        className="my-10 size-full min-h-[500px] overflow-hidden rounded-lg border-0 shadow-lg"
        allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
        sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
        {...rest}
      />
    </div>
  );
};

export default MDXCodeSandBox;
export type { MDXCodeSandBoxProps };
