#!/usr/bin/env ts-node
/**
 * Assign Role Script — CulturePassAU
 *
 * Sets a Firebase custom claim (role) on a user by email and syncs
 * the Firestore users/{uid} document so the app picks it up immediately.
 *
 * Run from the `functions/` directory:
 *
 *   npx ts-node scripts/assign-role.ts <email> <role>
 *
 * Example — make jiobaba369@gmail.com a platform admin:
 *   npx ts-node scripts/assign-role.ts jiobaba369@gmail.com platformAdmin
 *
 * Valid roles:
 *   user | organizer | business | sponsor | cityAdmin | moderator | admin | platformAdmin
 *
 * Prerequisites:
 *   - Run `firebase login` first (or set GOOGLE_APPLICATION_CREDENTIALS)
 *   - GOOGLE_CLOUD_PROJECT env var OR update PROJECT_ID below
 */

import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT ?? 'culturepass-2e058';

const VALID_ROLES = [
  'user', 'organizer', 'business', 'sponsor',
  'cityAdmin', 'moderator', 'admin', 'platformAdmin',
] as const;
type ValidRole = typeof VALID_ROLES[number];

const [,, email, role] = process.argv;

if (!email || !role) {
  console.error('Usage: npx ts-node scripts/assign-role.ts <email> <role>');
  console.error('Valid roles:', VALID_ROLES.join(' | '));
  process.exit(1);
}

if (!VALID_ROLES.includes(role as ValidRole)) {
  console.error(`❌ Invalid role "${role}". Valid roles: ${VALID_ROLES.join(', ')}`);
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const auth = admin.auth();
const db = admin.firestore();

async function run() {
  console.log(`\n🔍 Looking up user: ${email}`);

  let userRecord: admin.auth.UserRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    console.error(`❌ No Firebase Auth user found for email: ${email}`);
    console.error('   Make sure the user has signed up in the app first.');
    process.exit(1);
  }

  const uid = userRecord.uid;
  const existingClaims = userRecord.customClaims ?? {};
  const existingRole = existingClaims['role'] ?? 'user';

  console.log(`✅ Found user: ${userRecord.displayName ?? userRecord.email}`);
  console.log(`   UID:          ${uid}`);
  console.log(`   Current role: ${existingRole}`);
  console.log(`   New role:     ${role}`);

  // 1. Set Firebase custom claims (read by auth middleware on every request)
  await auth.setCustomUserClaims(uid, { ...existingClaims, role });
  console.log('\n✅ Custom claims updated (Firebase Auth)');

  // 2. Sync to Firestore users/{uid} (read by /api/auth/me response)
  await db.collection('users').doc(uid).set({ role }, { merge: true });
  console.log('✅ Firestore users/{uid} synced');

  console.log(`\n🎉 Done! ${email} is now: ${role}`);
  console.log('   The user must sign out and back in for the role to take effect in the app.');
}

run().catch(err => {
  console.error('❌ Script failed:', err);
  process.exit(1);
});
