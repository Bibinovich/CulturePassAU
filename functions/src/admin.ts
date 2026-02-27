/**
 * Firebase Admin SDK initialization — Cloud Functions side only.
 * Never imported by the Expo client bundle.
 */

import * as admin from 'firebase-admin';

const explicitBucket = process.env.FIREBASE_STORAGE_BUCKET;
if (!admin.apps.length) {
  admin.initializeApp(explicitBucket ? { storageBucket: explicitBucket } : undefined);
}

/** Firestore database instance */
export const db = admin.firestore();

/** Firebase Auth Admin instance (for verifyIdToken, setCustomUserClaims, etc.) */
export const authAdmin = admin.auth();

/** Firebase Storage bucket (for image uploads) */
export const storageBucket = (() => {
  try {
    return admin.storage().bucket();
  } catch {
    return null;
  }
})();

const projectEnv =
  process.env.FIREBASE_PROJECT_ID ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.GCLOUD_PROJECT ??
  process.env.PROJECT_ID ??
  null;

export const projectId = admin.apps[0]?.options?.projectId ?? projectEnv;
export const isFirestoreConfigured = Boolean(projectId);
