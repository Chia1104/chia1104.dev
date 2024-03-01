"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@nextui-org/react";
import { post } from "@chia/utils";

const SpotifyLogin = () => {
  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      post<{ url: string }>("http://localhost:3003/oauth/spotify/authorize", {
        state: crypto.getRandomValues(new Uint8Array(16)).join(""),
        scopes: ["user-read-currently-playing"],
      }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
  });

  return (
    <Button
      isLoading={isPending}
      onPress={() => {
        mutate();
      }}>
      Login with Spotify
    </Button>
  );
};

export default SpotifyLogin;
