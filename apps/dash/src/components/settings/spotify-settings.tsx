"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import {
  Avatar,
  Button,
  Card,
  Chip,
  Description,
  Label,
  Radio,
  RadioGroup,
  Spinner,
} from "@heroui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  Music2,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/libs/orpc/client";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

const callbackMessages: Record<
  string,
  { type: "success" | "error"; message: string }
> = {
  connected: {
    type: "success",
    message: "Spotify account connected",
  },
  cancelled: {
    type: "error",
    message: "Spotify authorization cancelled",
  },
  invalid_callback: {
    type: "error",
    message: "Invalid Spotify callback",
  },
  invalid_state: {
    type: "error",
    message: "Spotify authorization expired. Please reconnect.",
  },
  exchange_failed: {
    type: "error",
    message: "Unable to complete Spotify authorization",
  },
};

const formatDate = (value: string) => {
  return dateFormatter.format(new Date(value));
};

export const SpotifySettings = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const callbackStatus = searchParams.get("spotify");

  const accountsQuery = useQuery(orpc.spotify.manage.accounts.queryOptions());

  const authorizationMutation = useMutation(
    orpc.spotify.manage.authorize.mutationOptions({
      onSuccess: ({ url }) => {
        window.location.assign(url);
      },
      onError: () => {
        toast.error("Unable to start Spotify authorization");
      },
    })
  );

  const activateMutation = useMutation(
    orpc.spotify.manage.activate.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.spotify.manage.accounts.queryKey(),
        });
        toast.success("Active playback account updated");
      },
      onError: () => {
        toast.error("Unable to switch Spotify accounts");
      },
    })
  );

  const disconnectMutation = useMutation(
    orpc.spotify.manage.disconnect.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.spotify.manage.accounts.queryKey(),
        });
        toast.success("Spotify account disconnected");
      },
      onError: () => {
        toast.error("Unable to disconnect Spotify account");
      },
    })
  );

  useEffect(() => {
    if (!callbackStatus) {
      return;
    }

    const result = callbackMessages[callbackStatus];
    if (result?.type === "success") {
      toast.success(result.message);
      void queryClient.invalidateQueries({
        queryKey: orpc.spotify.manage.accounts.queryKey(),
      });
    } else {
      toast.error(result?.message ?? "Spotify authorization failed");
    }
    router.replace("/settings/spotify");
  }, [callbackStatus, queryClient, router]);

  if (accountsQuery.isPending) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner aria-label="Loading Spotify accounts" />
      </div>
    );
  }

  if (accountsQuery.isError) {
    return (
      <Card className="w-full">
        <Card.Content className="flex items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            <CircleAlert className="text-danger size-5" />
            <div>
              <p className="font-medium">Unable to load Spotify settings</p>
              <p className="text-muted text-sm">
                Check the service and database connection.
              </p>
            </div>
          </div>
          <Button variant="outline" onPress={() => accountsQuery.refetch()}>
            Retry
          </Button>
        </Card.Content>
      </Card>
    );
  }

  const { accounts, currentUserId } = accountsQuery.data;
  const currentAccount = accounts.find(
    (account) => account.userId === currentUserId
  );
  const activeAccount = accounts.find((account) => account.isActive);

  return (
    <div className="flex w-full flex-col gap-5">
      <Card className="relative w-full overflow-hidden">
        <div className="pointer-events-none absolute -top-24 right-0 size-72 rounded-full bg-[radial-gradient(circle,rgba(30,215,96,0.16),transparent_65%)]" />
        <Card.Header className="relative flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="bg-success/10 text-success flex size-10 items-center justify-center rounded-xl">
              <Music2 size={20} />
            </div>
            <div>
              <Card.Title>Spotify connection</Card.Title>
              <Card.Description>
                Connect your Spotify account to keep Now Playing tokens
                refreshed securely.
              </Card.Description>
            </div>
          </div>
          {currentAccount ? (
            <Chip color="success" variant="soft">
              <Chip.Label>Connected</Chip.Label>
            </Chip>
          ) : (
            <Chip variant="soft">
              <Chip.Label>Not connected</Chip.Label>
            </Chip>
          )}
        </Card.Header>
        <Card.Content className="relative space-y-5">
          {currentAccount ? (
            <div className="border-border bg-surface-secondary/50 flex flex-col gap-4 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar>
                  <Avatar.Image
                    src={currentAccount.spotifyImageUrl ?? undefined}
                    alt={currentAccount.spotifyDisplayName ?? "Spotify"}
                  />
                  <Avatar.Fallback>
                    {(currentAccount.spotifyDisplayName ?? "S")
                      .charAt(0)
                      .toUpperCase()}
                  </Avatar.Fallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {currentAccount.spotifyDisplayName ?? "Spotify user"}
                  </p>
                  <div className="text-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="flex items-center gap-1">
                      <Clock3 size={12} />
                      Token expires:{" "}
                      {formatDate(currentAccount.accessTokenExpiresAt)}
                    </span>
                    <span>Updated: {formatDate(currentAccount.updatedAt)}</span>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  variant="outline"
                  isPending={authorizationMutation.isPending}
                  onPress={() => authorizationMutation.mutate(undefined)}>
                  <RefreshCw />
                  Reauthorize
                </Button>
                <Button
                  variant="danger-soft"
                  isPending={disconnectMutation.isPending}
                  onPress={() => disconnectMutation.mutate(undefined)}>
                  <Unplug />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-border flex flex-col items-start gap-4 rounded-2xl border border-dashed p-5">
              <div>
                <p className="font-medium">Spotify is not connected</p>
                <p className="text-muted mt-1 text-sm">
                  Authorization only requests access to your currently playing
                  track. It cannot modify playlists.
                </p>
              </div>
              <Button
                variant="primary"
                isPending={authorizationMutation.isPending}
                onPress={() => authorizationMutation.mutate(undefined)}>
                <Music2 />
                Connect with Spotify
              </Button>
            </div>
          )}
        </Card.Content>
      </Card>

      <Card className="w-full">
        <Card.Header>
          <Card.Title className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            Active playback account
          </Card.Title>
          <Card.Description>
            The public `/spotify/playing` endpoint uses this account and
            refreshes its access token automatically.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          {accounts.length > 0 ? (
            <RadioGroup
              name="active-spotify-account"
              value={activeAccount?.userId ?? ""}
              variant="secondary"
              isDisabled={activateMutation.isPending}
              onChange={(userId) => {
                if (userId !== activeAccount?.userId) {
                  activateMutation.mutate({ userId });
                }
              }}>
              <Label className="sr-only">Active playback account</Label>
              {accounts.map((account) => (
                <Radio
                  key={account.userId}
                  value={account.userId}
                  className="border-border data-[selected=true]:border-success/60 data-[selected=true]:bg-success/5 rounded-xl border p-4">
                  <Radio.Content>
                    <Radio.Control>
                      <Radio.Indicator />
                    </Radio.Control>
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">
                          {account.spotifyDisplayName ?? "Spotify user"}
                        </span>
                        <span className="text-muted block truncate text-xs">
                          Connected by: {account.adminName}
                        </span>
                      </span>
                      {account.isActive ? (
                        <Chip color="success" size="sm" variant="soft">
                          <Chip.Label>Active</Chip.Label>
                        </Chip>
                      ) : null}
                    </span>
                  </Radio.Content>
                  <Description>
                    Scope: {account.scope || "user-read-currently-playing"}
                  </Description>
                </Radio>
              ))}
            </RadioGroup>
          ) : (
            <p className="text-muted py-4 text-sm">
              No Spotify accounts are available. Connect one above to select an
              active playback account.
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
};
