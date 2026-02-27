/**
 * Firebase client SDK initialization — Expo app side.
 * Consumed by lib/auth.tsx and any screen that needs client Firebase access.
 *
 * All config is read from EXPO_PUBLIC_* env vars so they are baked
 * into the bundle at build time (Expo convention).
 *
 * ─── Setup ─────────────────────────────────────────────────────────────────
 * 1. Go to: console.firebase.google.com → your project → Project Settings
 *    → Your apps → Web app → SDK setup and configuration
 * 2. Copy the config values into your .env file (see .env.example)
 * 3. For EAS builds set the same vars inside eas.json build.*.env
 * ───────────────────────────────────────────────────────────────────────────
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  connectAuthEmulator,
  type Persistence,
} from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { Platform } from 'react-native';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirebaseWebConfig,
  shouldUseFirebaseEmulators,
  getFirebaseEmulatorHost,
} from '@/lib/config';

const firebaseConfig = getFirebaseWebConfig();

// Guard against duplicate initialization in hot-reload / fast refresh
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

/**
 * Firebase Auth instance with platform-appropriate persistence:
 * - Web:     localStorage (Firebase default via getAuth)
 * - Native:  AsyncStorage (survives app restarts)
 *
 * getReactNativePersistence exists in Metro's RN bundle but is absent from the
 * web TypeScript types, so we resolve it via require() to avoid TS2305.
 * initializeAuth throws if called twice on the same app (hot reload),
 * so we fall back to getAuth() which returns the existing instance.
 */
export const auth = (() => {
  if (Platform.OS === 'web') {
    return getAuth(firebaseApp);
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require('firebase/auth') as {
      getReactNativePersistence: (storage: typeof ReactNativeAsyncStorage) => Persistence;
    };
    return initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(ReactNativeAsyncStorage),
    });
  } catch {
    // Auth already initialized (Expo fast refresh)
    return getAuth(firebaseApp);
  }
})();

export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

let emulatorsConnected = false;

if (__DEV__ && shouldUseFirebaseEmulators() && !emulatorsConnected) {
  const host = Platform.OS === 'android' ? '10.0.2.2' : getFirebaseEmulatorHost();

  try {
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  } catch {}

  try {
    connectFirestoreEmulator(db, host, 8080);
  } catch {}

  try {
    connectStorageEmulator(storage, host, 9199);
  } catch {}

  emulatorsConnected = true;
}
