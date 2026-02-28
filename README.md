# CulturePass

A cross-platform Expo + React Native lifestyle app connecting cultural diaspora communities across Australia, New Zealand, UAE, UK, and Canada. Discover events, join communities, find local businesses, and celebrate diversity.

## Platform Coverage

| Platform | Technology | Distribution |
|----------|-----------|-------------|
| iOS | React Native (Expo) | App Store via EAS Build |
| Android | React Native (Expo) | Google Play via EAS Build |
| Web | Expo Web (Metro) | Firebase Hosting |

## Architecture

```
Frontend (Expo + React Native)
├── app/              # File-based routing (Expo Router)
├── components/       # Reusable UI components
├── constants/        # Design tokens (colors, typography, spacing, animations)
├── contexts/         # Client state (auth, onboarding, saved, contacts)
├── hooks/            # Custom React hooks
├── lib/              # Auth, API client, feature flags, utilities
└── shared/           # Shared TypeScript types (EventData, User, Ticket…)

Backend (Firebase Functions + Express)
├── functions/src/            # Express API + middleware + services
├── functions/src/services/   # Firestore, search, cache, rollout
└── functions/src/middleware/ # Auth + moderation

Cloud (Firebase)
├── functions/        # Cloud Functions (events, payments, tickets, webhooks)
└── firebase.json     # Hosting + security headers
```

For a full architecture breakdown see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quick Start

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..

# 2. Copy environment variables and fill in your values
cp .env.example .env

# 3. Quality checks
npm run lint          # ESLint
npm run typecheck     # TypeScript
npm run qa:all        # Unit + integration + E2E smoke tests

# 4. Start development
npm run start         # Expo dev server (iOS / Android / Web)
firebase emulators:start --only functions,firestore,auth,storage
```

### Environment Variables

Copy `.env.example` → `.env` and fill in the required values:

```bash
# Firebase client SDK (baked into bundle at build time)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# API base URL (use emulator URL for local dev)
EXPO_PUBLIC_API_URL=http://127.0.0.1:5001/<project>/us-central1/api/

# Stripe — Cloud Functions side only (never in Expo bundle)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY_ID=price_...
STRIPE_PRICE_YEARLY_ID=price_...
```

For EAS builds, mirror these in `eas.json` under `build.*.env`.

## Build and deploy

See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for full deployment instructions.

Publishing readiness checklist: [`docs/PUBLISHING_READINESS.md`](docs/PUBLISHING_READINESS.md).

### iOS App Store
```bash
eas build --profile production --platform ios
eas submit --profile production --platform ios
```

### Google Play Store
```bash
eas build --profile production --platform android
eas submit --platform android
```

### Web (Firebase Hosting)
```bash
npm run expo:static:build
firebase deploy --only hosting
```

## Key Features

- **Event Discovery** — Browse, search, and filter cultural events by city, category, and date
- **Community Hub** — Join and manage diaspora communities
- **Ticketing** — Purchase tickets, QR code scanning, Apple/Google Wallet integration
- **Business Directory** — Find cultural restaurants, venues, and local businesses
- **Membership Tiers** — Free, Plus, Elite, Pro, Premium, VIP with cashback perks
- **Loyalty Perks** — Earn and redeem rewards across the platform
- **First Nations Spotlight** — Celebrating Indigenous Australian culture
- **Multi-Region** — Australia, New Zealand, UAE, UK, and Canada

## Design System

The app uses a unified design token system for a consistent, futuristic look and feel:

| Module | File | Purpose |
|--------|------|---------|
| Colors | `constants/colors.ts` | Light/dark themes, glassmorphism, gradient presets |
| Typography | `constants/typography.ts` | Poppins font family, iOS-style type scale |
| Spacing | `constants/spacing.ts` | 4-point grid, border radii, layout constants |
| Animations | `constants/animations.ts` | Duration, spring configs, motion preferences |

## CI/CD

GitHub Actions runs on every push and PR:
- **TypeScript type check** — catches type errors
- **ESLint** — enforces code style
- **Unit tests** — validates services and middleware
- **Web export** — verifies the web bundle compiles

See `.github/workflows/quality-gate.yml` for the full pipeline.

## Documentation

| Document | Description |
|----------|-------------|
| [`ARCHITECTURE.md`](docs/ARCHITECTURE.md) | System design and layer overview |
| [`APP_DOCUMENTATION.md`](docs/APP_DOCUMENTATION.md) | Full feature guide |
| [`DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Build, test, and deploy instructions |
| [`PUBLISHING_READINESS.md`](docs/PUBLISHING_READINESS.md) | App Store / Play Store checklist |
| [`API_ENDPOINTS.md`](docs/API_ENDPOINTS.md) | REST API reference |
| [`ROUTE_API_MATRIX.md`](docs/ROUTE_API_MATRIX.md) | Route to API mapping |
| [`PROJECT_ENHANCEMENT_PLAN.md`](docs/PROJECT_ENHANCEMENT_PLAN.md) | Roadmap |
| [`RELEASE_NOTES.md`](docs/RELEASE_NOTES.md) | Version history |
| [`MAINTENANCE.md`](docs/MAINTENANCE.md) | Ongoing maintenance and release guardrails |

## Tech Stack

- **Frontend**: React 19, React Native 0.83, Expo 55, Expo Router 55
- **State**: TanStack Query 5, React Context
- **UI**: Reanimated 4, Expo Linear Gradient, Expo Blur / Glass Effect
- **Backend**: Firebase Cloud Functions (Express), Node.js 22, TypeScript 5.9
- **Database**: Firestore
- **Payments**: Stripe
- **Hosting**: Firebase Hosting (web), Firebase Functions (API), EAS (native builds)

## License

Private — all rights reserved.
