# CulturePass Architecture (Expo + Firebase)

## Runtime Targets

Single codebase via Expo + React Native:

- iOS (EAS Build / App Store)
- Android (EAS Build / Google Play)
- Web (Expo export + Firebase Hosting)

---

## System Layers

### 1) Presentation Layer

- `app/` — Expo Router route screens
- `components/` — reusable UI building blocks
- `constants/theme.ts` — design tokens and component primitives
- `hooks/useColors.ts` + `hooks/useLayout.ts` — adaptive theming + responsive layout

### 2) Client State + Session Layer

- `lib/auth.tsx` — Firebase Auth observer, user session, token sync
- `contexts/*` — onboarding, saved items, contacts

### 3) Data Access Layer

- `lib/query-client.ts` — API transport, URL normalization, retry/caching policy
- `lib/api.ts` — typed endpoint surface (`api.events`, `api.tickets`, `api.auth`, ...)
- `shared/schema.ts` — shared client/server domain contracts

### 4) Backend Layer

- `functions/src/index.ts` — Cloud Function entry (`api`)
- `functions/src/app.ts` — Express app with route handlers
- `functions/src/middleware` — Firebase auth + moderation
- `functions/src/services` — Firestore services (events, tickets, wallets, notifications, perks, reports, media, feedback), weighted search, rollout, cache

---

## Auth + Request Flow

1. User signs in with Firebase Auth SDK in Expo app.
2. `onAuthStateChanged` in `lib/auth.tsx` retrieves ID token.
3. Token is synced to query transport via `setAccessToken`.
4. API requests include `Authorization: Bearer <idToken>`.
5. Functions middleware verifies token and authorizes route access.

This pattern keeps auth centralized and hook-safe, while avoiding token logic in individual screens.

---

## Scalability + Performance Patterns (Implemented)

- Centralized runtime config validation in `lib/config.ts`
- API URL normalization to prevent route duplication (`/api/api/...`)
- Typed API layer and shared schema contracts to reduce runtime mismatch bugs
- Firestore-backed persistence for wallets, notifications, perks/redemptions, reports, media, and event feedback
- Query retry policy that avoids retry storms on 4xx errors
- Cached request helper for high-frequency read paths
- Optional Firebase emulator wiring for fast local iteration

---

## Current Feature Surface

- Onboarding + authentication
- Discover, events, communities, perks, profile tabs
- Event details, ticketing, QR scan paths
- Membership upgrade flow
- Notifications, contacts, saved/search/map screens
- Legal/help/settings routes

---

## Cross-Platform Strategy

CulturePass already uses the recommended cross-platform path: Expo + React Native + Expo Router.

- Keep one codebase for iOS/Android/Web
- Use platform-specific components only where necessary (`*.native.tsx`, `*.web.tsx`)
- Preserve typed contracts and shared UI primitives for maintainability

A Flutter rewrite is possible but not recommended unless business requirements justify duplicate maintenance and migration risk.

---

## Recommended Next Scalability Upgrades

1. Add route-level payload validation on backend with zod for all write endpoints.
2. Add Firestore composite indexes for high-cardinality event filters.
3. Split very large route screens into feature modules (e.g., event detail sections).
4. Add web-focused E2E checks (Playwright) alongside existing smoke scripts.
5. Add structured runtime telemetry (Sentry + performance traces).
