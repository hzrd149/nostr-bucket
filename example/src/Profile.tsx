import { createSignal, createEffect, Show } from "solid-js";
import type { NostrEvent } from "nostr-tools";

interface ProfileProps {
  pubkey: string;
}

export default function Profile(props: ProfileProps) {
  const [profile, setProfile] = createSignal<NostrEvent | undefined>(undefined);
  const [loading, setLoading] = createSignal(true);

  createEffect(async () => {
    if (!window.nostrdb) return;

    setLoading(true);
    try {
      // Fetch profile using replaceable method for kind 0 (profile metadata)
      const profileEvent = await window.nostrdb.replaceable(0, props.pubkey);
      setProfile(profileEvent);
    } catch (error) {
      console.error("Failed to fetch profile:", error);
    } finally {
      setLoading(false);
    }
  });

  const getProfileData = () => {
    const event = profile();
    if (!event) return null;

    try {
      return JSON.parse(event.content);
    } catch {
      return null;
    }
  };

  const profileData = getProfileData();

  return (
    <div class="flex items-center space-x-3">
      <Show
        when={!loading()}
        fallback={
          <div class="w-10 h-10 bg-base-300 rounded-full animate-pulse"></div>
        }
      >
        <div class="avatar placeholder">
          <div class="bg-primary text-primary-content rounded-full w-10">
            <span class="text-sm font-bold">
              {profileData?.display_name?.charAt(0) ||
                profileData?.name?.charAt(0) ||
                props.pubkey.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      </Show>

      <div class="flex-1 min-w-0">
        <Show
          when={!loading()}
          fallback={
            <div class="h-4 bg-base-300 rounded animate-pulse w-24"></div>
          }
        >
          <p class="text-sm font-medium truncate">
            {profileData?.display_name || profileData?.name || "Anonymous"}
          </p>
        </Show>

        <Show
          when={!loading()}
          fallback={
            <div class="h-3 bg-base-300 rounded animate-pulse w-16 mt-1"></div>
          }
        >
          <p class="text-xs opacity-70 truncate">
            {props.pubkey.slice(0, 8)}...{props.pubkey.slice(-8)}
          </p>
        </Show>
      </div>
    </div>
  );
}
