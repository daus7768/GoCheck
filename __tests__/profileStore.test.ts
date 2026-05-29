import { useProfileStore } from '../src/store/profileStore';

// Mock supabase client + profile queries.
jest.mock('../src/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
  },
  getProfile: jest.fn(),
  upsertProfile: jest.fn(),
}));

// Mock expo-secure-store.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
  multiRemove: jest.fn().mockResolvedValue(undefined),
}));

const RESET = {
  session: null,
  profile: null,
  isGuest: false,
  security: { pinEnabled: false, biometricEnabled: false, autoLockDuration: 300 },
  isLoading: false,
  isUnlocked: false,
  error: null,
};

describe('profileStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState(RESET);
  });

  it('starts with no session and no profile', () => {
    const s = useProfileStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.isGuest).toBe(false);
  });

  it('continueAsGuest loads a local guest profile and flags guest mode', async () => {
    await useProfileStore.getState().continueAsGuest();
    const s = useProfileStore.getState();
    expect(s.isGuest).toBe(true);
    expect(s.profile?.displayName).toBe('Guest');
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gocheck_guest_mode', 'true');
  });

  it('updateProfile (guest) updates local state and persists on-device only', async () => {
    await useProfileStore.getState().continueAsGuest();
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const { upsertProfile } = require('../src/lib/supabase');
    await useProfileStore.getState().updateProfile({ darkMode: true });
    expect(useProfileStore.getState().profile?.darkMode).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('gocheck_guest_profile', expect.any(String));
    expect(upsertProfile).not.toHaveBeenCalled();
  });

  it('updateProfile (authenticated) syncs via upsertProfile', async () => {
    const { upsertProfile } = require('../src/lib/supabase');
    const base = {
      id: 'user-1', displayName: 'Test', avatarUrl: null,
      defaultCurrency: 'MYR' as const, darkMode: false, offlineMode: false,
      paymentMethods: [], notifPush: true, notifEmail: true,
      notifWhatsapp: false, notifDueSoon: true, notifOverdue: true, notifWeeklyDigest: false,
    };
    upsertProfile.mockResolvedValue({ ...base, darkMode: true });
    useProfileStore.setState({ profile: base, session: { user: { id: 'user-1' } } as any });

    await useProfileStore.getState().updateProfile({ darkMode: true });
    expect(upsertProfile).toHaveBeenCalled();
    expect(useProfileStore.getState().profile?.darkMode).toBe(true);
  });

  it('updateSecuritySetting saves to SecureStore', async () => {
    const SecureStore = require('expo-secure-store');
    await useProfileStore.getState().updateSecuritySetting('pinEnabled', true);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('gocheck_pin_enabled', 'true');
    expect(useProfileStore.getState().security.pinEnabled).toBe(true);
  });

  it('signOut clears session, profile, and guest mode', async () => {
    useProfileStore.setState({
      session: { user: { id: 'u1' } } as any,
      profile: { id: 'u1' } as any,
      isGuest: true,
    });
    await useProfileStore.getState().signOut();
    const s = useProfileStore.getState();
    expect(s.session).toBeNull();
    expect(s.profile).toBeNull();
    expect(s.isGuest).toBe(false);
  });
});
