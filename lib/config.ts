type RequiredFirebaseEnvKey =
  | 'EXPO_PUBLIC_FIREBASE_API_KEY'
  | 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN'
  | 'EXPO_PUBLIC_FIREBASE_PROJECT_ID'
  | 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET'
  | 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'
  | 'EXPO_PUBLIC_FIREBASE_APP_ID';

const REQUIRED_FIREBASE_KEYS: RequiredFirebaseEnvKey[] = [
  'EXPO_PUBLIC_FIREBASE_API_KEY',
  'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'EXPO_PUBLIC_FIREBASE_APP_ID',
];

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '') + '/';
}

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

export function getExplicitApiUrl(): string | undefined {
  const apiUrl = getEnv('EXPO_PUBLIC_API_URL');
  return apiUrl ? normalizeBaseUrl(apiUrl) : undefined;
}

export function getMissingFirebaseEnvKeys(): RequiredFirebaseEnvKey[] {
  return REQUIRED_FIREBASE_KEYS.filter((key) => !getEnv(key));
}

export function getFirebaseWebConfig() {
  const missing = getMissingFirebaseEnvKeys();
  if (missing.length > 0) {
    throw new Error(
      '[CulturePass] Missing Firebase environment variables: ' + missing.join(', ') +
      '. Add them to .env and EAS build profiles.'
    );
  }

  return {
    apiKey: getEnv('EXPO_PUBLIC_FIREBASE_API_KEY')!,
    authDomain: getEnv('EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN')!,
    projectId: getEnv('EXPO_PUBLIC_FIREBASE_PROJECT_ID')!,
    storageBucket: getEnv('EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET')!,
    messagingSenderId: getEnv('EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID')!,
    appId: getEnv('EXPO_PUBLIC_FIREBASE_APP_ID')!,
  };
}

export function shouldUseFirebaseEmulators(): boolean {
  return getEnv('EXPO_PUBLIC_USE_FIREBASE_EMULATORS') === 'true';
}

export function getFirebaseEmulatorHost(): string {
  return getEnv('EXPO_PUBLIC_FIREBASE_EMULATOR_HOST') ?? '127.0.0.1';
}
