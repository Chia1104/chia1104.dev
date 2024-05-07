"use client";

import { type FC } from "react";
import { Image, cn, ImageZoom } from "@chia/ui";

const images = [
  {
    id: 1,
    alt: "me-1",
    src: "https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/me-1.JPG",
  },
  {
    id: 2,
    alt: "me-2",
    src: "/me/me.JPG",
  },
  {
    id: 3,
    alt: "group-1",
    src: "https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/group-1.JPG",
  },
  {
    id: 4,
    alt: "group-2",
    src: "https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/group-2.JPG",
  },
  {
    id: 5,
    alt: "graph-1",
    src: "https://pliosymjzzmsswrxbkih.supabase.co/storage/v1/object/public/public-assets/www/graph-1.jpg",
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
