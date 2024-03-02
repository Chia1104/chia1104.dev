"use client";

import { useMutation } from "@tanstack/react-query";
import { Button } from "@nextui-org/react";
import { serviceRequest, type HTTPError } from "@chia/utils";
import { toast } from "sonner";

const SpotifyLogin = () => {
  const { mutate, isPending } = useMutation<
    {
      url: string;
    },
    HTTPError
  >({
    mutationFn: () =>
      serviceRequest()
        .post(`/oauth/spotify/authorize`, {
          json: {
            state: crypto.getRandomValues(new Uint8Array(16)).join(""),
            scopes: ["user-read-currently-playing"],
          },
        })
        .json<{
          url: string;
        }>(),
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (error) => {
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
