"use client";

import { type FC } from "react";
import Zoom, { type UncontrolledProps } from "react-medium-image-zoom";

const ImageZoom: FC<UncontrolledProps> = (props) => {
  return <Zoom zoomMargin={40} {...props} />;
};

export default ImageZoom;
