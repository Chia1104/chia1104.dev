"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@chia/ui";
import { post } from "@chia/utils";

export default function SpotifyTest() {
  const { mutate } = useMutation({
    mutationFn: () =>
      post<{ url: string }, { state: string; scopes: string[] }>(
        "http://localhost:3003/oauth/spotify/authorize",
        {
          state: window.crypto
            .getRandomValues(new Uint32Array(5))[0]
            .toString(),
          scopes: ["user-read-currently-playing"],
        }
      ),
    onSuccess: (data) => (window.location.href = data.url),
  });
  return <Button onClick={() => mutate()}>Spotify Login</Button>;
}
