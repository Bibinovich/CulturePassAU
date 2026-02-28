# CulturePass AU — New Firebase Project Setup

Complete guide for deploying to a brand-new Firebase account.
Estimated time: 30–60 minutes.

---

## Prerequisites

```bash
npm install -g firebase-tools
npm install -g eas-cli
firebase login
```

---

## Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `culturepass-prod`)
3. Enable Google Analytics if desired → **Create project**
4. Note your **Project ID** (shown in project settings)

---

## Step 2 — Enable Firebase Services

In the Firebase Console for your new project:

### Authentication
- **Build → Authentication → Get started**
- Enable **Email/Password** provider

### Firestore
- **Build → Firestore Database → Create database**
- Choose **Start in production mode**
- Select region: `australia-southeast1` (Sydney)

### Storage
- **Build → Storage → Get started**
- Accept the default rules → **Done**

### Hosting
- **Build → Hosting → Get started** → follow the wizard

---

## Step 3 — Get Firebase Config

1. **Project Settings** (gear icon) → **Your apps** → **Web app** (add one if none)
2. Copy the `firebaseConfig` object — you'll need all 6 values

---

## Step 4 — Update Project Files

### .firebaserc
```json
{
  "projects": {
    "default": "YOUR_NEW_PROJECT_ID"
  }
}
```

### .env (copy from .env.example)
```bash
cp .env.example .env
```
Fill in all `EXPO_PUBLIC_FIREBASE_*` values from Step 3.
Set `EXPO_PUBLIC_API_URL=https://us-central1-YOUR_NEW_PROJECT_ID.cloudfunctions.net/api/`

### functions/.env (copy from functions/.env.example)
```bash
cp functions/.env.example functions/.env
```
Add your Stripe keys (get from [dashboard.stripe.com](https://dashboard.stripe.com)).

---

## Step 5 — Generate Firebase Admin SDK Key

1. **Project Settings → Service accounts**
2. Click **Generate new private key** → download JSON
3. Place it in `functions/` (the `.gitignore` already excludes `*firebase-adminsdk*.json`)
4. The admin SDK auto-discovers it via `GOOGLE_APPLICATION_CREDENTIALS` or the default location

For Cloud Functions deployment, Firebase handles credentials automatically — you don't need the key file in production.

---

## Step 6 — Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Step 7 — Deploy Cloud Functions

```bash
cd functions
npm run build
cd ..
firebase deploy --only functions
```

> **First deploy takes ~5 minutes.** Functions will appear in the Firebase Console.

---

## Step 8 — Seed Initial Data (optional)

Set `SEED_SECRET=any-secret-value` in `functions/.env`, redeploy functions, then:

```bash
curl -X POST https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/admin/seed \
  -H "x-seed-secret: any-secret-value"
```

Clear `SEED_SECRET` afterward and redeploy.

---

## Step 9 — Deploy Web App

```bash
npx expo export --platform web
firebase deploy --only hosting
```

Your app will be live at `https://YOUR_PROJECT_ID.web.app`

---

## Step 10 — Set Up EAS (mobile builds)

```bash
eas init          # creates EAS project, fills in app.json projectId
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_API_KEY --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_FIREBASE_APP_ID --value YOUR_VALUE
eas secret:create --scope project --name EXPO_PUBLIC_API_URL --value YOUR_VALUE
```

Then build:
```bash
eas build --platform all --profile production
```

---

## Step 11 — Stripe Setup (for membership payments)

1. Create a [Stripe account](https://stripe.com) if you don't have one
2. **Products → Add product** → create a subscription product with:
   - Monthly price (~AUD 9.99/month)
   - Annual price (~AUD 79.99/year)
3. Copy the `price_xxx` IDs into `functions/.env`
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.deleted`, `charge.refunded`
5. Copy the webhook signing secret into `functions/.env` as `STRIPE_WEBHOOK_SECRET`

---

## Checklist

- [ ] Firebase project created
- [ ] Auth, Firestore, Storage, Hosting enabled
- [ ] `.env` filled with Firebase config values
- [ ] `.firebaserc` updated with new project ID
- [ ] `functions/.env` has Stripe keys
- [ ] Firestore rules deployed
- [ ] Cloud Functions deployed
- [ ] Web app exported and hosted
- [ ] EAS secrets configured (for mobile builds)
- [ ] Stripe products and webhook configured

---

## Troubleshooting

**Functions deploy fails**: Run `cd functions && npm run build` first — check for TypeScript errors.

**Auth not working on web**: Check `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` is set correctly in `.env`.

**CORS errors**: Ensure `/api/**` rewrite is in `firebase.json` (it is by default).

**Firestore permission denied**: Check `firestore.rules` is deployed and user is authenticated.
