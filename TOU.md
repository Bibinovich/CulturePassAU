# CulturePass AU — TOU.md

Project guide for TOU AI agents and engineers. Read this before touching code.

## Project Overview

Cross-platform lifestyle/community platform for cultural diaspora communities (AU, NZ, UAE, UK, CA).
**Stack**: Expo 54 + React Native 0.81 + Expo Router 6 + Firebase (Auth + Firestore + Cloud Functions + Storage).

---

## Architecture

```
app/               Expo Router screens (54+)
  (onboarding)/    Login, signup, location setup
  (tabs)/          5-tab layout: Discover, Calendar, Community, Perks, Profile
  event/[id].tsx   Event detail (large screen — ~2600 lines)
components/
  ui/              Button, Card, Badge — always use these, never raw Pressable+Text
  EventCard.tsx    Memoized event list item
  ErrorBoundary.tsx
constants/
  colors.ts        Light + dark themes, shadows, glass, gradients, neon
  theme.ts         Master re-export + component tokens (ButtonTokens, CardTokens…)
  typography.ts    Poppins scale with desktop overrides
  spacing.ts       4-point grid, breakpoints, radius
hooks/
  useColors.ts     Theme-aware color access
  useLayout.ts     Responsive layout values (isDesktop, numColumns, hPad…)
lib/
  api.ts           Typed API client — use this for all API calls
  auth.tsx         Firebase Auth provider + useAuth() hook
  firebase.ts      Firebase client SDK init (platform-aware persistence)
  query-client.ts  TanStack React Query setup + apiRequest()
contexts/          OnboardingContext, SavedContext, ContactsContext
shared/schema.ts   Shared TypeScript types (EventData, User, Ticket…)
functions/src/     Firebase Cloud Functions (Express app)
  app.ts           90+ API routes
  admin.ts         Firebase Admin SDK singleton
  middleware/      auth.ts (Firebase ID token), moderation.ts
  services/
    firestore.ts   Typed Firestore data service (eventsService, usersService…)
    search.ts      Weighted full-text + trigram search
    cache.ts       In-memory TTL cache
    rollout.ts     Feature flag phased rollout
```

---

## Essential Rules for TOU Implementation

### Never Do
- Call `useAuth()` outside a React component — use `setAccessToken` / module-level token store instead.
- Use `any` casts — always type properly; use `Record<string, unknown>` + explicit casts.
- Hardcode colors, spacing, or font sizes — use `useColors()`, `Spacing`, `TextStyles`.
- Write raw `Pressable` + `Text` buttons — use `<Button>` from `components/ui`.
- Import from individual `constants/` files in screens — import from `constants/theme`.
- Add duplicate routes to `app.ts` — check line 699+ for existing patterns.
- Add features without reading CLAUDE.md or this guide first.
- Make assumptions about type definitions — verify in `shared/schema.ts`.

### Always Do
- Use `api.*` from `lib/api.ts` for data fetching, not raw `fetch()`.
- Use `useLayout()` for responsive values (padding, columns, breakpoints).
- Use `useColors()` for theme-aware colors (never hardcode hex in components).
- Wrap new screens in `<ErrorBoundary>` if they have async data.
- Use `ApiError` from `lib/api.ts` to handle errors with status codes.
- Consult CLAUDE.md before making architecture decisions.
- Test locally with `npm run typecheck` before considering changes complete.
- Document breaking changes or new patterns in this guide.

---

## TOU-Specific Guidelines

### Code Analysis & Understanding
- Use multi-file context when analyzing logic — check both the API client and service layer.
- When the user describes a feature, cross-reference existing implementations in `app/` first.
- Verify type safety by reading the corresponding schema in `shared/schema.ts`.
- Check Firebase security rules in `firestore.rules` before proposing data operations.

### Implementation Approach
- Start with codebase reading/analysis before proposing changes.
- Use `search_subagent` for large codebase exploration tasks.
- Prefer updates to existing patterns over introducing new patterns.
- Validate changes against the design system (colors, spacing, typography from `constants/theme`).
- Run type checking after implementation: `npm run typecheck`.

### Documentation & Communication
- Keep change summaries concise — document only what's new or modified.
- Reference specific file paths using markdown links, e.g., [app/event/[id].tsx](app/event/%5Bid%5D.tsx).
- For complex changes, add comments to non-obvious code sections.
- When proposing architectural changes, reference CLAUDE.md patterns.

---

## Environment Variables

Copy `.env.example` → `.env` and fill in:

```bash
# Firebase (client SDK — baked into bundle at build time)
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=

# API base URL (prod Cloud Functions URL)
EXPO_PUBLIC_API_URL=https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/

# Stripe (Cloud Functions side only — never in Expo bundle)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
# Create these in Stripe Dashboard → Products → Pricing
STRIPE_PRICE_MONTHLY_ID=price_...
STRIPE_PRICE_YEARLY_ID=price_...
```

For EAS builds, mirror these in `eas.json` under `build.*.env`.

---

## Local Development

```bash
# Install
npm install
cd functions && npm install && cd ..

# Start Expo (native + web)
npx expo start

# Start Cloud Functions emulator
firebase emulators:start --only functions,firestore,auth,storage

# Type check
npm run typecheck

# Lint
npm run lint
```

Set `EXPO_PUBLIC_API_URL=http://localhost:5001/YOUR_PROJECT/us-central1/api/` when using the emulator.

---

## Testing

```bash
npm run test:unit          # Service + middleware unit tests
npm run test:integration   # API route integration tests (requires running server)
npm run test:e2e:smoke     # Critical path smoke tests
npm run qa:all             # All of the above
```

---

## Building & Deploying

### iOS (App Store)

```bash
# 1. Bump version in app.json (version + ios.buildNumber)
# 2. Build with EAS
eas build --platform ios --profile production

# 3. Submit to App Store Connect
eas submit --platform ios
```

Requires: Apple Developer account, `eas.json` production profile configured.

### Android (Google Play)

```bash
# 1. Bump version in app.json (version + android.versionCode)
eas build --platform android --profile production
eas submit --platform android
```

### Web (Firebase Hosting)

```bash
# Build the Expo web export
npx expo export --platform web

# Deploy to Firebase Hosting
firebase deploy --only hosting
```

Web output goes to `dist/` — Firebase Hosting serves it at your `.web.app` domain.

### Cloud Functions

```bash
cd functions
npm run build           # TypeScript compile → lib/

cd ..
firebase deploy --only functions
```

Functions deploy to `us-central1` by default (`firebase.json`).

**Always deploy functions before the app** when adding new endpoints.

---

## Firestore Data Model

```
users/{uid}
  username, displayName, email, city, country
  role: 'user' | 'organizer' | 'moderator' | 'admin'
  membership: { tier, expiresAt }
  isSydneyVerified, interests[], culturePassId
  createdAt, updatedAt

events/{eventId}
  title, description, venue, date, time, city, country
  imageUrl, cultureTag[], tags[], category
  priceCents, tiers[], isFree, isFeatured
  organizerId, capacity, attending
  deletedAt (soft delete), publishedAt
  cpid (CP-EVT-xxx), geoHash

tickets/{ticketId}
  eventId, userId, status, paymentStatus
  qrCode, cpTicketId, priceCents
  history[]: { action, timestamp, actorId }

profiles/{profileId}
  entityType: 'community' | 'business' | 'venue' | 'artist'
  name, description, imageUrl, city, country
  ownerId, verified, rating
```

### Firestore Security Rules
See [firestore.rules](firestore.rules). Key rules:
- Users can read/write their own `users/{uid}` doc.
- Events: anyone can read published; only organizer/admin can write.
- Tickets: owner can read; Cloud Functions write via Admin SDK (bypasses rules).

---

## Design System Quick Reference

```ts
import { useColors }  from '@/hooks/useColors';      // theme colors
import { useLayout }  from '@/hooks/useLayout';       // responsive layout
import { Colors, TextStyles, Spacing,
         ButtonTokens, CardTokens }  from '@/constants/theme';

import { Button, Card, Badge } from '@/components/ui';
```

**Color roles**: `primary` CTA · `secondary` purple · `accent` orange · `gold` premium
**Gradients**: `gradients.aurora` hero · `gradients.primary` brand · `gradients.sunset` warm
**Neon** (use sparingly): `neon.blue` · `neon.purple` · `neon.teal` for focused/active states

---

## Common TOU Tasks

### Adding a New API Endpoint
1. Check [functions/src/app.ts](functions/src/app.ts) for existing patterns (line 699+)
2. Add route to Express app with proper auth middleware
3. Add typed function to `functions/src/services/firestore.ts`
4. Export wrapper in [lib/api.ts](lib/api.ts) using `apiRequest()`
5. Use in components via `api.yourFeature.yourEndpoint()`

### Creating a New Screen
1. Create file in [app/](app/) following existing folder structure
2. Wrap with `<ErrorBoundary>` if async data needed
3. Use `useColors()` + `useLayout()` for styling
4. Import from `constants/theme`, not individual files
5. Add route if needed (Expo Router auto-routes)

### Adding UI Components
1. Check [components/ui/](components/ui/) for existing components first
2. Use tokens from `ButtonTokens`, `CardTokens`, etc.
3. Accept `testID` prop for testing
4. Memoize with `React.memo()` if component is pure
5. Export from component index file

### Migrating In-Memory Data to Firestore
1. Define schema in [shared/schema.ts](shared/schema.ts)
2. Add Firestore document structure to this guide
3. Create service in [functions/src/services/firestore.ts](functions/src/services/firestore.ts)
4. Add API endpoint in [functions/src/app.ts](functions/src/app.ts)
5. Update security rules in [firestore.rules](firestore.rules)
6. Add tests in [functions/src/](functions/src/)

---

## Known Gaps (Production Readiness Checklist)

- [x] Stripe real payment flow — subscription checkout, webhook handler, cancel all wired to Firestore
- [x] Profiles/communities routes migrated from in-memory → Firestore
- [x] Custom Firebase claims via `authAdmin.setCustomUserClaims` — tier synced on subscribe/cancel
- [x] `api.membership.*` namespace in [lib/api.ts](lib/api.ts) — `subscribe`, `get`, `cancel`, `memberCount`
- [ ] Migrate remaining in-memory Maps (wallets, notifications, perks, tickets) → Firestore
- [ ] Google / Apple social sign-in (buttons exist; auth flow not wired)
- [ ] Push notifications (FCM token registration)
- [ ] Offline mutation queue (AsyncStorage → sync on reconnect)
- [ ] Geolocation filtering (geoHash stored, not queried)
- [ ] Analytics (PostHog / Firebase Analytics)
- [ ] Error monitoring (Sentry)

---

## Quick Reference: When to Ask Before Implementing

- Any changes to authentication flow (auth.tsx or Firebase security rules)
- Database schema changes (requires migration strategy)
- New npm dependencies or major version bumps
- Changes to the design system tokens
- New API endpoints that might conflict with existing routes
- Deployment workflow changes

Refer to CLAUDE.md for more detailed architectural context.
