"use client";

import dynamic from "next/dynamic";
import type { FC } from "react";

import type { UncontrolledProps } from "react-medium-image-zoom";

const Zoom = dynamic(() => import("react-medium-image-zoom"), {
  ssr: false,
});

const ImageZoom: FC<UncontrolledProps> = (props) => {
  return <Zoom zoomMargin={40} {...props} />;
};

export default ImageZoom;
