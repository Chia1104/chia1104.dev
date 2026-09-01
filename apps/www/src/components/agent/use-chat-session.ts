"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { X_CAPTCHA_RESPONSE } from "@chia/api/captcha/constants";
import { authClient } from "@chia/auth/client";

export interface ChatUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  /** A guest minted by better-auth's anonymous plugin, not a person who signed in. */
  isAnonymous: boolean;
}

export const chatSessionQueryKey = ["agent-chat-session"] as const;

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>["user"];

const chatUserOf = (user: SessionUser): ChatUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image ?? null,
  isAnonymous: user.isAnonymous === true,
});

/**
 * Who the chat runs as: a signed-in person, a guest from an earlier visit, or `null` when the
 * visitor has no session yet and must pass the human check first.
 */
export const useChatSession = () =>
  useQuery({
    queryKey: chatSessionQueryKey,
    queryFn: async (): Promise<ChatUser | null> => {
      const current = await authClient.getSession();
      return current.data ? chatUserOf(current.data.user) : null;
    },
    staleTime: Infinity,
    retry: false,
  });

/**
 * Mints the guest user row that owns sessions and spend. The captcha token proves a human
 * asked; the server refuses the sign-in without it.
 */
export const useStartGuest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (captchaToken: string): Promise<ChatUser> => {
      const guest = await authClient.signIn.anonymous({
        fetchOptions: { headers: { [X_CAPTCHA_RESPONSE]: captchaToken } },
      });
      if (guest.error) {
        throw new Error(guest.error.message ?? guest.error.statusText);
      }
      return chatUserOf(guest.data.user);
    },
    onSuccess: (user) => queryClient.setQueryData(chatSessionQueryKey, user),
  });
};
