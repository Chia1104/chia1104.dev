import { getPlayList } from "@/app/api/(v1)/v1/spotify/utils";
import type { PlayList } from "@/app/api/(v1)/v1/spotify/types";
import { Image, cn, ImageZoom, FadeIn } from "@chia/ui";
import { type FC } from "react";
import Link from "next/link";
import { env } from "@/env.mjs";

const ImageItem: FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => (
  <ImageZoom>
    <div
      className={cn(
        "not-prose relative w-full overflow-hidden rounded-lg shadow-md",
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

const PlayIcon: FC<{
  className?: string;
}> = ({ className }) => (
  <span
    className={cn(
      "bg-success/90 flex items-center justify-center rounded-full p-3 text-white",
      className
    )}>
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="h-6 w-6">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    </svg>
  </span>
);

const First: FC<{
  data: ReturnType<typeof getTop4>[0];
}> = ({ data }) => {
  return (
    <div className="flex w-full flex-col items-center sm:items-start">
      <span className="group relative w-2/3">
        <ImageItem
          src={data.track.album.images[0].url}
          alt={data.track.album.name}
          className="aspect-h-1 aspect-w-1"
        />
        <Link
          href={data.track.external_urls.spotify}
          target="_blank"
          className="absolute inset-0 z-10"
        />
        <PlayIcon className="absolute bottom-1 right-5 opacity-0 transition-all duration-300 ease-in-out group-hover:bottom-5 group-hover:opacity-100" />
      </span>
      <h3 className="line-clamp-2">
        {data.track.name} - {data.track.artists[0].name}
      </h3>
    </div>
  );
};

const Item: FC<{
  data: ReturnType<typeof getTop4>[0];
}> = ({ data }) => {
  return (
    <div className="hover:dark:bg-dark/80 relative grid w-full grid-cols-3 items-center justify-center gap-3 rounded-lg transition-all hover:cursor-pointer hover:bg-white/80 hover:shadow-md">
      <span className="col-span-1">
        <ImageItem
          src={data.track.album.images[0].url}
          alt={data.track.album.name}
          className="aspect-h-1 aspect-w-1"
        />
      </span>
      <p className="col-span-2 line-clamp-2">
        {data.track.name} - {data.track.artists[0].name}
      </p>
      <Link
        href={data.track.external_urls.spotify}
        className="absolute inset-0"
        target="_blank"
      />
    </div>
  );
};

const getTop4 = (data: PlayList) => {
  return data.tracks.items.slice(0, 4);
};

export default async function Page() {
  const playlist = await getPlayList({
    revalidate: 60 * 30,
  });
  const data = getTop4(playlist);
  return (
    <FadeIn className="w-full flex-col">
      <div className="c-bg-third relative grid w-full grid-cols-1 gap-2 overflow-hidden rounded-lg px-5 py-7 sm:grid-cols-2 sm:py-3">
        <div className="flex w-full items-center">
          <First data={data[0]} />
        </div>
        <div className="flex w-full flex-col gap-3">
          <Item data={data[1]} />
          <Item data={data[2]} />
          <Item data={data[3]} />
        </div>
        <div className="dark:c-bg-gradient-purple-to-pink c-bg-gradient-yellow-to-pink absolute -z-40 h-full w-full opacity-50 blur-3xl" />
      </div>
      <p className="flex items-center gap-3">
        <span>
          Check out the{" "}
          <Link
            href={`https://open.spotify.com/playlist/${env.SPOTIFY_FAVORITE_PLAYLIST_ID}`}>
            {playlist.name}
          </Link>{" "}
          on my Spotify.
        </span>
        <span className="i-mdi-spotify h-8 w-8 text-[#1DB954]" />
      </p>
    </FadeIn>
  );
}
