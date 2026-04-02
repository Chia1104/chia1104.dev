import type { ImageProps as NextImageProps } from "next/image";
import NextImage from "next/image";
import { ViewTransition } from "react";

import { Skeleton } from "@heroui/react";

import { Root, ResourceActivity, Fallback } from "@chiastack/ui/image";

export type ImageProps = NextImageProps;

const Image = (props: ImageProps) => {
  return (
    <Root>
      <ResourceActivity src={props.src as string}>
        <NextImage {...props} aria-label={props.alt} />
      </ResourceActivity>
      <ViewTransition>
        <Fallback className="relative">
          <Skeleton className="absolute inset-0 h-full w-full" />
        </Fallback>
      </ViewTransition>
    </Root>
  );
};

export default Image;
