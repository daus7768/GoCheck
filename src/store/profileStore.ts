import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase, getProfile, upsertProfile } from '../lib/supabase';
import type { UserProfile, SecuritySettings } from '../types';

const PIN_KEY = 'gocheck_pin_hash';
const SECURITY_KEY = 'gocheck_security';

interface ProfileState {
  session: Session | null;
  sessionInitialized: boolean;
  profile: UserProfile | null;
  security: SecuritySettings;
  isLocked: boolean;
  isLoading: boolean;

  // auth
  setSession: (session: Session | null) => void;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;

  // profile
  loadProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Omit<UserProfile, 'id'>>) => Promise<void>;

  // security (on-device only)
  loadSecurity: () => Promise<void>;
  saveSecurity: (s: Partial<SecuritySettings>) => Promise<void>;
  setPinHash: (hash: string) => Promise<void>;
  getPinHash: () => Promise<string | null>;

  // lock
  lock: () => void;
  unlock: () => void;
}

const DEFAULT_SECURITY: SecuritySettings = {
  pinEnabled: false,
  biometricEnabled: false,
  autoLockDuration: 300,
};

export const useProfileStore = create<ProfileState>((set, get) => ({
  session: null,
  sessionInitialized: false,
  profile: null,
  security: DEFAULT_SECURITY,
  isLocked: false,
  isLoading: false,

  setSession: (session) => set({ session, sessionInitialized: true }),

  signInWithGoogle: async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'gocheck://auth/callback',
      },
    });
    if (error) throw error;
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // best-effort — clear local state regardless of network/token errors
    }
    set({ session: null, profile: null, isLocked: false });
  },

  loadProfile: async () => {
    const { session } = get();
    if (!session?.user) return;
    set({ isLoading: true });
    try {
      let profile = await getProfile(session.user.id);
      if (!profile) {
        profile = await upsertProfile({
          id: session.user.id,
          displayName: session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Organizer',
          avatarUrl: session.user.user_metadata?.avatar_url ?? null,
        });
      }
      set({ profile });

      // Register Expo push token for payment notifications
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
          const eas = extra?.eas as Record<string, unknown> | undefined;
          const projectId = eas?.projectId as string | undefined;
          const { data: token } = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
          );
          if (token && token !== profile.expoPushToken) {
            const updated = await upsertProfile({ id: session.user.id, expoPushToken: token });
            set({ profile: updated });
          }
        }
      } catch {
        // Push tokens not available in web or certain simulators — safe to ignore
      }
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (patch) => {
    const { session, profile } = get();
    if (!session?.user) return;
    // Optimistic update so toggles/changes feel instant. Roll back on failure.
    const previous = profile;
    if (profile) set({ profile: { ...profile, ...patch } });
    try {
      const updated = await upsertProfile({ id: session.user.id, ...patch });
      set({ profile: updated });
    } catch (err) {
      if (previous) set({ profile: previous });
      throw err;
    }
  },

  loadSecurity: async () => {
    try {
      const raw = await SecureStore.getItemAsync(SECURITY_KEY);
      if (raw) set({ security: { ...DEFAULT_SECURITY, ...JSON.parse(raw) } });
    } catch {
      // secure store not available on web
    }
  },

  saveSecurity: async (patch) => {
    const next = { ...get().security, ...patch };
    set({ security: next });
    try {
      await SecureStore.setItemAsync(SECURITY_KEY, JSON.stringify(next));
    } catch {}
  },

  setPinHash: async (hash) => {
    try {
      await SecureStore.setItemAsync(PIN_KEY, hash);
    } catch {}
  },

  getPinHash: async () => {
    try {
      return await SecureStore.getItemAsync(PIN_KEY);
    } catch {
      return null;
    }
  },

  lock: () => set({ isLocked: true }),
  unlock: () => set({ isLocked: false }),
}));
