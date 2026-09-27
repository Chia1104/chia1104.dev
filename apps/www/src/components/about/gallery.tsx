import Image from "next/image";
import type { FC } from "react";

import ImageZoom from "@chia/ui/image-zoom";
import { cn } from "@chia/ui/utils/cn.util";

const images = [
  {
    id: 1,
    alt: "me-1",
    src: "https://storage.chia1104.dev/me-1.jpeg",
  },
  {
    id: 2,
    alt: "me-2",
    src: "https://storage.chia1104.dev/me.jpeg",
  },
  {
    id: 3,
    alt: "group-1",
    src: "https://storage.chia1104.dev/graph-1.jpg",
  },
  {
    id: 4,
    alt: "group-2",
    src: "https://storage.chia1104.dev/group-2.jpeg",
  },
  {
    id: 5,
    alt: "graph-1",
    src: "https://storage.chia1104.dev/graph-1.jpg",
  },
] as const;

const ImageItem: FC<{
  src: string;
  alt: string;
  /** The rendered width; `page-sm` splits the 768px column from 640px up. */
  sizes: string;
  /** The first photo is the desktop LCP element, so it must not wait for layout. */
  eager?: boolean;
  className?: string;
}> = ({ src, alt, sizes, eager = false, className }) => (
  <ImageZoom>
    <div className={cn("relative w-full overflow-hidden", className)}>
      <Image
        src={src}
        alt={alt}
        className="w-full object-cover"
        fill
        sizes={sizes}
        loading={eager ? "eager" : "lazy"}
      />
    </div>
  </ImageZoom>
);

/** Photos set in a ruled grid: the 1px gaps show the rule colour, so every cell is framed once. */
const Gallery = () => {
  return (
    <div className="rule-b bg-separator grid w-full grid-cols-2 gap-px pb-px">
      <span className="page-sm:col-span-1 col-span-2">
        <ImageItem
          src={images[4].src}
          alt={images[4].alt}
          sizes="(min-width: 640px) 384px, 100vw"
          eager
          className="page-sm:aspect-square aspect-2/1"
        />
      </span>
      <div className="page-sm:col-span-1 col-span-2 grid w-full grid-cols-2 gap-px">
        <span>
          <ImageItem
            src={images[0].src}
            alt={images[0].alt}
            sizes="(min-width: 640px) 192px, 50vw"
            className="aspect-square"
          />
        </span>
        <span>
          <ImageItem
            src={images[1].src}
            alt={images[1].alt}
            sizes="(min-width: 640px) 192px, 50vw"
            className="aspect-square"
          />
        </span>
        <span className="col-span-2">
          <ImageItem
            src={images[3].src}
            alt={images[3].alt}
            sizes="(min-width: 640px) 384px, 100vw"
            className="aspect-2/1"
          />
        </span>
      </div>
    </div>
  );
};

export default Gallery;
