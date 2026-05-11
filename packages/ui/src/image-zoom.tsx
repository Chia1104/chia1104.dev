"use client";

import { useCallback, useEffect, useRef } from "react";

import type {
  ControlledProps,
  UncontrolledProps,
} from "react-medium-image-zoom";
import Zoom from "react-medium-image-zoom";

type ZoomContentData = Parameters<
  NonNullable<ControlledProps["ZoomContent"]>
>[0];

interface ZoomContentInnerProps extends ZoomContentData {
  scrollYRef: React.RefObject<number>;
  userContent?: UncontrolledProps["ZoomContent"];
}

function ZoomContentInner({
  modalState,
  buttonUnzoom,
  img,
  isZoomImgLoaded,
  onUnzoom,
  scrollYRef,
  userContent: UserContent,
}: ZoomContentInnerProps) {
  const prevModalState = useRef(modalState);

  useEffect(() => {
    const prev = prevModalState.current;
    prevModalState.current = modalState;
    // bodyScrollEnable() calls window.scrollTo(0, prevScrollY) with scroll-behavior: smooth,
    // but dialog.close() focus management interrupts the animation.
    // Force an instant scroll to override.
    if (prev === "UNLOADING" && modalState === "UNLOADED") {
      window.scrollTo({ top: scrollYRef.current, behavior: "instant" });
    }
  }, [modalState, scrollYRef]);

  if (UserContent) {
    return (
      <UserContent
        modalState={modalState}
        buttonUnzoom={buttonUnzoom}
        img={img}
        isZoomImgLoaded={isZoomImgLoaded}
        onUnzoom={onUnzoom}
      />
    );
  }
  return (
    <>
      {img}
      {buttonUnzoom}
    </>
  );
}

const ImageZoom = ({
  onZoomChange,
  ZoomContent,
  ...props
}: UncontrolledProps) => {
  const savedScrollY = useRef(0);

  const zoomContent = useCallback<
    NonNullable<UncontrolledProps["ZoomContent"]>
  >(
    (data) => (
      <ZoomContentInner
        {...data}
        scrollYRef={savedScrollY}
        userContent={ZoomContent}
      />
    ),
    [ZoomContent]
  );

  return (
    <Zoom
      zoomMargin={40}
      onZoomChange={(isZoomed, data) => {
        if (isZoomed) {
          savedScrollY.current = window.scrollY;
        }
        onZoomChange?.(isZoomed, data);
      }}
      ZoomContent={zoomContent}
      {...props}
    />
  );
};

export default ImageZoom;
