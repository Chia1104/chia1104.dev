"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import { SpotifySettings } from "@/components/settings/spotify-settings";

const Page = () => {
  return (
    <div className="mx-auto flex w-full max-w-175 flex-col gap-5 p-4 py-10">
      <div>
        <p className="text-muted text-sm">Settings</p>
        <h1 className="text-2xl font-semibold">Spotify</h1>
      </div>
      <ErrorBoundary>
        <SpotifySettings />
      </ErrorBoundary>
    </div>
  );
};

export default Page;
