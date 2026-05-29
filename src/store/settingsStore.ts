import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Currency } from '../types';

export type NotificationKey =
  | 'push'
  | 'email'
  | 'whatsapp'
  | 'dueSoon'
  | 'overdue'
  | 'weeklyDigest';

export type PaymentMethodKey = 'duitnow' | 'card' | 'paypal' | 'bank';

export interface PaymentMethod {
  enabled: boolean;
  label: string;
  /** Only populated for account-bound methods like DuitNow. */
  id?: string;
}

export interface AppSettings {
  profileName: string;
  defaultCurrency: Currency;
  darkMode: boolean;
  notifications: Record<NotificationKey, boolean>;
  security: {
    biometric: boolean;
    pinSet: boolean;
    autoLockMinutes: number;
  };
  paymentMethods: Record<PaymentMethodKey, PaymentMethod>;
  offline: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  profileName: 'You',
  defaultCurrency: 'MYR',
  darkMode: false,
  notifications: {
    push: true,
    email: true,
    whatsapp: true,
    dueSoon: true,
    overdue: true,
    weeklyDigest: false,
  },
  security: {
    biometric: false,
    pinSet: false,
    autoLockMinutes: 5,
  },
  paymentMethods: {
    duitnow: { enabled: true, label: 'DuitNow', id: 'you@bank' },
    card: { enabled: true, label: 'Card (Stripe)' },
    paypal: { enabled: false, label: 'PayPal' },
    bank: { enabled: true, label: 'Bank transfer' },
  },
  offline: false,
};

interface SettingsStore extends AppSettings {
  hydrated: boolean;
  setProfileName: (name: string) => void;
  setDefaultCurrency: (currency: Currency) => void;
  setDarkMode: (on: boolean) => void;
  setNotification: (key: NotificationKey, value: boolean) => void;
  setSecurity: <K extends keyof AppSettings['security']>(
    key: K,
    value: AppSettings['security'][K]
  ) => void;
  setPaymentMethodEnabled: (key: PaymentMethodKey, enabled: boolean) => void;
  setOffline: (on: boolean) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      hydrated: false,

      setProfileName: (profileName) => set({ profileName }),
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      setDarkMode: (darkMode) => set({ darkMode }),

      setNotification: (key, value) =>
        set((state) => ({ notifications: { ...state.notifications, [key]: value } })),

      setSecurity: (key, value) =>
        set((state) => ({ security: { ...state.security, [key]: value } })),

      setPaymentMethodEnabled: (key, enabled) =>
        set((state) => ({
          paymentMethods: {
            ...state.paymentMethods,
            [key]: { ...state.paymentMethods[key], enabled },
          },
        })),

      setOffline: (offline) => set({ offline }),

      reset: () => set({ ...DEFAULT_SETTINGS }),
    }),
    {
      name: 'settleup.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (state) state.hydrated = true;
      },
    }
  )
);
