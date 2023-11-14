"use client";

import { type FC } from "react";
import { Image, cn, ImageZoom } from "@chia/ui";

const images = [
  {
    id: 1,
    alt: "me-1",
    src: "https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fme-1.JPG?alt=media",
  },
  {
    id: 2,
    alt: "me-2",
    src: "/me/me.JPG",
  },
  {
    id: 3,
    alt: "group-1",
    src: "https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fgroup-1.JPG?alt=media",
  },
  {
    id: 4,
    alt: "group-2",
    src: "https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fgroup-2.JPG?alt=media",
  },
  {
    id: 5,
    alt: "graph-1",
    src: "https://firebasestorage.googleapis.com/v0/b/chia1104.appspot.com/o/images%2Fgraph-1.jpg?alt=media",
  },
];

const ImageItem: FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => (
  <ImageZoom>
    <div
      className={cn(
        "not-prose relative w-full overflow-hidden rounded-lg",
        className
      )}>
      <Image
        src={src}
        alt={alt}
        className="w-full object-cover"
        fill
        loading="lazy"
      />
    </div>
  </ImageZoom>
);

const Gallery = () => {
  return (
    <div className="not-prose grid w-full grid-cols-2 gap-2">
      <span className="col-span-2 sm:col-span-1">
        <ImageItem
          src={images[4].src}
          alt={images[4].alt}
          className="aspect-h-1 aspect-w-2 sm:aspect-w-1"
        />
      </span>
      <div className="col-span-2 grid w-full grid-cols-2 gap-2 sm:col-span-1">
        <span>
          <ImageItem
            src={images[0].src}
            alt={images[0].alt}
            className="aspect-h-1 aspect-w-1"
          />
        </span>
        <span>
          <ImageItem
            src={images[1].src}
            alt={images[1].alt}
            className="aspect-h-1 aspect-w-1"
          />
        </span>
        <span className="col-span-2">
          <ImageItem
            src={images[3].src}
            alt={images[3].alt}
            className="aspect-h-1 aspect-w-2"
          />
        </span>
      </div>
    </div>
  );
};

export default Gallery;
