"use client";

import { ErrorBoundary } from "@chia/ui/error-boundary";

import { SpotifySettings } from "@/components/settings/spotify-settings";

const Page = () => {
  return (
    <div className="page-container flex flex-col gap-5 py-8">
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
