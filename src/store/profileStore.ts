import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, getProfile, upsertProfile } from '../lib/supabase';
import type { UserProfile, SecuritySettings } from '../types';

const SECURE_KEYS = {
  pinHash: 'gocheck_pin_hash',
  pinEnabled: 'gocheck_pin_enabled',
  biometricEnabled: 'gocheck_biometric_enabled',
  autoLockDuration: 'gocheck_autolock_duration',
} as const;

const GUEST_FLAG_KEY = 'gocheck_guest_mode';
const GUEST_PROFILE_KEY = 'gocheck_guest_profile';

const GUEST_PROFILE: UserProfile = {
  id: 'guest',
  displayName: 'Guest',
  avatarUrl: null,
  defaultCurrency: 'MYR',
  darkMode: false,
  offlineMode: false,
  paymentMethods: ['duitnow', 'card', 'bank'],
  notifPush: true,
  notifEmail: true,
  notifWhatsapp: false,
  notifDueSoon: true,
  notifOverdue: true,
  notifWeeklyDigest: false,
};

interface ProfileStore {
  session: Session | null;
  profile: UserProfile | null;
  isGuest: boolean;
  security: SecuritySettings;
  isLoading: boolean;
  isUnlocked: boolean;
  error: string | null;

  initializeAuth: () => () => void;
  fetchProfile: (userId: string) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  updateProfile: (partial: Partial<UserProfile>) => Promise<void>;
  updateSecuritySetting: (key: keyof SecuritySettings, value: boolean | number) => Promise<void>;
  loadSecuritySettings: () => Promise<void>;
  setUnlocked: (val: boolean) => void;
  signOut: () => Promise<void>;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  session: null,
  profile: null,
  isGuest: false,
  security: { pinEnabled: false, biometricEnabled: false, autoLockDuration: 300 },
  isLoading: false,
  isUnlocked: false,
  error: null,

  initializeAuth: () => {
    const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session?.user) {
        set({ isGuest: false });
        await AsyncStorage.removeItem(GUEST_FLAG_KEY);
        await get().fetchProfile(session.user.id);
        await get().loadSecuritySettings();
      } else if (!get().isGuest) {
        // No Supabase session — restore guest mode if the user previously chose it.
        const flag = await AsyncStorage.getItem(GUEST_FLAG_KEY);
        if (flag === 'true') {
          await get().continueAsGuest();
        } else {
          set({ profile: null, isUnlocked: false });
        }
      }
    });
    return () => data.subscription.unsubscribe();
  },

  fetchProfile: async (userId) => {
    set({ isLoading: true, error: null });
    try {
      let profile = await getProfile(userId);
      if (!profile) {
        // First login — seed a profile from the auth provider metadata.
        const { data: { user } } = await supabase.auth.getUser();
        profile = await upsertProfile({
          id: userId,
          displayName:
            (user?.user_metadata?.full_name as string | undefined) ??
            user?.email ??
            'User',
          avatarUrl: (user?.user_metadata?.avatar_url as string | undefined) ?? null,
        });
      }
      set({ profile, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  continueAsGuest: async () => {
    const stored = await AsyncStorage.getItem(GUEST_PROFILE_KEY);
    let profile: UserProfile = GUEST_PROFILE;
    if (stored) {
      try {
        profile = { ...GUEST_PROFILE, ...(JSON.parse(stored) as Partial<UserProfile>) };
      } catch {
        profile = GUEST_PROFILE;
      }
    }
    await AsyncStorage.setItem(GUEST_FLAG_KEY, 'true');
    set({ isGuest: true, profile, session: null, isLoading: false, error: null });
    await get().loadSecuritySettings();
  },

  updateProfile: async (partial) => {
    const { profile, isGuest, session } = get();
    if (!profile) return;
    const next = { ...profile, ...partial };
    // Optimistic update
    set({ profile: next });
    try {
      if (isGuest || !session?.user) {
        // Guest preferences persist on-device only.
        await AsyncStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(next));
      } else {
        const updated = await upsertProfile({ ...next, id: session.user.id });
        set({ profile: updated });
      }
    } catch (e) {
      // Revert on failure
      set({ profile, error: String(e) });
    }
  },

  updateSecuritySetting: async (key, value) => {
    const secureKeyMap: Record<keyof SecuritySettings, string> = {
      pinEnabled: SECURE_KEYS.pinEnabled,
      biometricEnabled: SECURE_KEYS.biometricEnabled,
      autoLockDuration: SECURE_KEYS.autoLockDuration,
    };
    try {
      await SecureStore.setItemAsync(secureKeyMap[key], String(value));
    } catch (e) {
      // SecureStore is unavailable on web — keep the setting in-memory only.
      console.warn('[Profile] SecureStore unavailable:', e);
    }
    set(s => ({ security: { ...s.security, [key]: value } }));
  },

  loadSecuritySettings: async () => {
    try {
      const [pinEnabled, biometricEnabled, autoLockDuration] = await Promise.all([
        SecureStore.getItemAsync(SECURE_KEYS.pinEnabled),
        SecureStore.getItemAsync(SECURE_KEYS.biometricEnabled),
        SecureStore.getItemAsync(SECURE_KEYS.autoLockDuration),
      ]);
      set({
        security: {
          pinEnabled: pinEnabled === 'true',
          biometricEnabled: biometricEnabled === 'true',
          autoLockDuration: autoLockDuration ? parseInt(autoLockDuration, 10) : 300,
        },
      });
    } catch (e) {
      // SecureStore is unavailable on web — fall back to defaults (security off).
      console.warn('[Profile] SecureStore unavailable, security disabled:', e);
      set({ security: { pinEnabled: false, biometricEnabled: false, autoLockDuration: 300 } });
    }
  },

  setUnlocked: (val) => set({ isUnlocked: val }),

  signOut: async () => {
    await supabase.auth.signOut();
    await AsyncStorage.multiRemove([GUEST_FLAG_KEY, GUEST_PROFILE_KEY]);
    set({ session: null, profile: null, isGuest: false, isUnlocked: false, error: null });
  },
}));

export { SECURE_KEYS };
