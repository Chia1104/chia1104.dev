"use client";

import type { FC } from "react";
import Zoom from "react-medium-image-zoom";
import type { UncontrolledProps } from "react-medium-image-zoom";

const ImageZoom: FC<UncontrolledProps> = (props) => {
  return <Zoom zoomMargin={40} {...props} />;
};

export default ImageZoom;
