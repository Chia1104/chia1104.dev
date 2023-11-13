"use client";

import React, { type FC } from "react";
import Zoom, { type UncontrolledProps } from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import "./styles.css";

const ImageZoom: FC<UncontrolledProps> = (props) => {
  return <Zoom zoomMargin={40} {...props} />;
};

export default ImageZoom;
