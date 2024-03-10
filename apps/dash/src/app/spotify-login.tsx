"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@nextui-org/react";
import { post, type HTTPError } from "@chia/utils";
import { toast } from "sonner";

const SpotifyLogin = () => {
  const { mutate, isPending } = useMutation<
    {
      url: string;
    },
    HTTPError
  >({
    mutationFn: () =>
      post<
        {
          url: string;
        },
        {
          state: string;
          scopes: string[];
        }
      >(`/oauth/spotify/authorize`, {
        state: crypto.getRandomValues(new Uint8Array(16)).join(""),
        scopes: ["user-read-currently-playing"],
      }),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: () => {
      toast.error("You don't have permission to access Spotify.");
    },
  });

  return (
    <Button
      isLoading={isPending}
      onPress={() => {
        mutate();
      }}>
      Refresh Spotify Token
    </Button>
  );
};

export default SpotifyLogin;
