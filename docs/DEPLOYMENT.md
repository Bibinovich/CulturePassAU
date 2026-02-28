# Build, Test, and Deployment Guide

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | Runtime |
| npm | 10+ | Package manager |
| EAS CLI | 16+ | Native builds/submits (`npm install -g eas-cli`) |
| Firebase CLI | latest | Functions + Hosting deploy (`npm install -g firebase-tools`) |
| Xcode | latest stable | iOS local debugging |
| Android Studio | latest stable | Android local debugging |

---

## 1. Firebase Verification (Required Before Release)

Project for this app: `culturepass-2e058`

```bash
firebase projects:list
firebase use culturepass-2e058
```

Confirm in Firebase Console:
- Authentication is enabled
- Firestore is enabled
- Storage is enabled

Deploy security and indexes first:

```bash
firebase deploy --only firestore:rules,firestore:indexes,storage
```

Build + deploy Functions:

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

Verify API health:

```bash
curl https://us-central1-culturepass-2e058.cloudfunctions.net/api/health
```

Expected: HTTP `200` with `{ "ok": true, ... }`.

---

## 2. Environment Setup

1. Copy `.env.example` to `.env`.
2. Fill all `EXPO_PUBLIC_FIREBASE_*` values from Firebase Console.
3. Set API URL:
- Production: `https://us-central1-culturepass-2e058.cloudfunctions.net/api/`
- Emulator: `http://127.0.0.1:5001/culturepass-2e058/us-central1/api/`

For local Functions/Stripe testing, also set:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

## 3. Local Verification

```bash
npm install
cd functions && npm install && cd ..

npm run functions:build
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e:smoke
```

Run app:

```bash
npm run start
```

---

## 4. App Identifiers (Before First Store Submission)

Set production identifiers in `app.json`:

- iOS bundle ID: `au.culturepass.app`
- Android package: `au.culturepass.app`

(Already applied in this codebase.)

---

## 5. iOS App Store Deployment

### Account setup
1. Enrol in Apple Developer Program.
2. Create app in App Store Connect:
- Name: `CulturePass`
- Bundle ID: `au.culturepass.app`
- SKU: `culturepassau`

### `eas.json` submit config
Set:
- `submit.production.ios.appleId`
- `submit.production.ios.ascAppId`
- `submit.production.ios.appleTeamId`

### Build and submit

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

### iOS checklist
- 1024x1024 app icon (no alpha)
- 6.7" iPhone screenshots
- Privacy policy URL
- App Review notes (if using camera/location)
- Export compliance set correctly

---

## 6. Google Play Deployment

### Account setup
1. Create Google Play Console account.
2. Create app: `CulturePass`.
3. Setup API access + service account (Release Manager role).
4. Save service account JSON as `google-play-service-account.json` in project root.
5. Ensure it is ignored by git.

### First release requirement
The first Android upload must be manual in Play Console (Internal Testing track).
After that, `eas submit` automation works.

### Build and submit

```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

### Android checklist
- 512x512 app icon
- 1024x500 feature graphic
- Phone + tablet screenshots
- Privacy policy URL
- Data safety + content rating forms

---

## 7. Web Deployment

Build web bundle:

```bash
npx expo export --platform web
```

Deploy hosting:

```bash
firebase deploy --only hosting
```

---

## 8. Recommended Release Order

```bash
# 1) Deploy backend first
cd functions && npm run build && cd ..
firebase deploy --only functions
firebase deploy --only firestore:rules,firestore:indexes,storage

# 2) iOS
eas build --platform ios --profile production
eas submit --platform ios --profile production

# 3) Android
eas build --platform android --profile production
eas submit --platform android --profile production

# 4) Web
npx expo export --platform web
firebase deploy --only hosting
```

---

## 9. Post-Deploy Smoke Checklist

- Login/signup works
- Event discovery loads
- Ticket checkout session creates successfully
- Ticket appears under user account
- Perk redemption and notifications work
- `/api/health` and `/api/status` respond in production
