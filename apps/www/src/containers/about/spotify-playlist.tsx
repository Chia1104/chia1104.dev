import Link from "next/link";
import type { FC } from "react";

import type { PlayList } from "@chia/integrations/spotify/types";
import { NoiseBackground } from "@chia/shaders/noise-background";
import Image from "@chia/ui/image";
import { cn } from "@chia/ui/utils/cn.util";

import PreviewLink from "@/components/commons/preview-link";
import { env } from "@/env";
import { client } from "@/libs/orpc/client.rsc";

type PlaylistItem = PlayList["tracks"]["items"][number];

const ImageItem: FC<{
  src: string;
  alt: string;
  className?: string;
}> = ({ src, alt, className }) => (
  <div
    className={cn(
      "not-prose relative w-full overflow-hidden rounded-2xl shadow-md",
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
      className="size-6">
      <title>Play Icon</title>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z"
      />
    </svg>
  </span>
);

const First: FC<{
  data: PlaylistItem;
}> = ({ data }) => {
  return (
    <div className="page-sm:items-start flex w-full flex-col items-center">
      <span className="group relative w-2/3">
        <ImageItem
          src={data.track.album.images[0]?.url ?? ""}
          alt={data.track.album.name}
          className="aspect-square"
        />
        <Link
          href={data.track.external_urls.spotify}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-10"
        />
        <PlayIcon className="absolute right-5 bottom-1 opacity-0 transition-all duration-300 ease-in-out group-hover:bottom-5 group-hover:opacity-100" />
      </span>
      <h3 className="mt-3 line-clamp-2 text-base font-semibold">
        {data.track.name} - {data.track.artists[0]?.name}
      </h3>
    </div>
  );
};

const Item: FC<{
  data: PlaylistItem;
}> = ({ data }) => {
  return (
    <div className="hover:bg-background/70 relative grid w-full grid-cols-3 items-center justify-center gap-3 rounded-2xl text-sm transition-colors">
      <span className="col-span-1">
        <ImageItem
          src={data.track.album.images[0]?.url ?? ""}
          alt={data.track.album.name}
          className="aspect-square"
        />
      </span>
      <p className="col-span-2 line-clamp-2">
        {data.track.name} - {data.track.artists[0]?.name}
      </p>
      <Link
        href={data.track.external_urls.spotify}
        className="absolute inset-0"
        target="_blank"
        rel="noopener noreferrer"
      />
    </div>
  );
};

export async function SpotifyPlaylist() {
  const playlist = await client.spotify.playlist({
    playlistId: env.SPOTIFY_FAVORITE_PLAYLIST_ID ?? "default",
  });
  const [first, second, third, fourth] = playlist.tracks.items;
  const href = `https://open.spotify.com/playlist/${playlist.id}`;

  return (
    <div className="rule-t">
      <NoiseBackground
        gradientColors={{
          light: ["#F9C851", "#FCA5A5"],
          // Tailwind purple-400 and pink-400; the shader needs concrete colors.
          dark: ["oklch(71.4% 0.203 305.504)", "oklch(71.8% 0.202 349.761)"],
        }}
        containerClassName="border-separator rounded-none border-t"
        className="page-sm:grid-cols-2 page-sm:py-4 grid w-full grid-cols-1 gap-2 px-4 py-6">
        <div className="flex w-full items-center">
          {first && <First data={first} />}
        </div>
        <div className="flex w-full flex-col gap-3">
          {second && <Item data={second} />}
          {third && <Item data={third} />}
          {fourth && <Item data={fourth} />}
        </div>
      </NoiseBackground>
      <p className="rule-t flex items-center gap-2 px-4 py-3 text-sm">
        <span className="i-mdi-spotify size-5 shrink-0 text-[#1DB954]" />
        <span>
          Check out the{" "}
          <PreviewLink href={href} className="link">
            {playlist.name}
          </PreviewLink>{" "}
          on my Spotify.
        </span>
      </p>
    </div>
  );
}
