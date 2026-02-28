# Maintenance Guide

## Codebase Overview

- Frontend routes: `app/`
- Shared UI components: `components/`
- Theme/design system: `constants/theme.ts`
- State and auth: `contexts/`, `lib/auth.tsx`
- API transport + typed clients: `lib/query-client.ts`, `lib/api.ts`
- Runtime config/env validation: `lib/config.ts`
- Backend API: `functions/src/`
- Firestore service layer: `functions/src/services/firestore.ts`
- Shared domain contracts: `shared/schema.ts`

## Environment and Config Hygiene

- Keep `.env.example` up-to-date when adding `EXPO_PUBLIC_*` variables.
- Keep `eas.json` profile env keys aligned with `.env.example`.
- Validate Firebase keys before release builds.
- Use `EXPO_PUBLIC_USE_FIREBASE_EMULATORS=true` only in local/dev contexts.

## Release Quality Gate

Run before each merge to `main`:

```bash
npm run typecheck
npm run lint
npm run test:unit
```

For release candidates:

```bash
npm run test:integration
npm run test:e2e:smoke
```

## Performance Maintenance

- Keep data fetching through `lib/api.ts` or `apiRequest`.
- Prefer paginated endpoints for large lists.
- Avoid `any`; extend `shared/schema.ts` for new payloads.
- Split oversized route files into feature subcomponents.
- Audit React Query keys and stale times for high-traffic screens.
- Keep user data persistence in Firestore services (avoid in-memory runtime state in production paths).

## UI/UX Consistency Rules

- Use `useColors()` for runtime theme values.
- Use `useLayout()` for responsive spacing and breakpoints.
- Use design system components in `components/ui` for controls.
- Avoid hardcoded color tokens and spacing values in new screens.

## Deploy and Rollback

- Deploy Functions first for API changes.
- Deploy web next, then native binaries.
- Keep prior EAS build artifact IDs available for rollback.
- If an API rollout fails, redeploy previous Functions revision immediately.

---

## Stripe Webhook Monitoring

### Webhook endpoint

`POST /api/stripe/webhook` — registered in the Stripe Dashboard under **Developers → Webhooks**.

The endpoint URL for production is:
```
https://us-central1-YOUR_PROJECT.cloudfunctions.net/api/stripe/webhook
```

### Events to monitor

| Event | Effect |
|---|---|
| `checkout.session.completed` (subscription) | Activates `membership.tier = 'plus'` in Firestore; sets Firebase custom claim `tier: 'plus'` |
| `customer.subscription.updated` | Syncs tier/status and `expiresAt` from Stripe subscription period end |
| `customer.subscription.deleted` | Downgrades user to `tier: 'free'`, `isActive: false`; revokes Plus custom claim |
| `invoice.payment_failed` | Marks `membership.isActive = false` (grace period — tier stays `'plus'`) |
| `checkout.session.completed` (payment) | Marks ticket `status: 'confirmed'`, `paymentStatus: 'paid'` |
| `charge.refunded` | Marks ticket `status: 'cancelled'`, `paymentStatus: 'refunded'`; decrements `attending` on event |

### Checking delivery

1. Open [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks).
2. Click the endpoint and select the **Attempts** tab.
3. Failures show HTTP status returned by the Cloud Function. A `200` response means the event was processed.
4. For Cloud Function logs: `firebase functions:log --only api` or check **Google Cloud Logging** → filter by `resource.labels.function_name="api"`.

### Idempotency

Each Stripe event is recorded in the Firestore collection `stripeEvents/{event.id}` before processing. If the same event is delivered twice, the second attempt returns `{ received: true, message: 'Already processed' }` without side effects. This collection can be inspected in the Firebase Console for audit purposes.

### Re-delivering a failed event

1. In Stripe Dashboard → Webhooks → Attempts, click the failed event.
2. Click **Resend** — Stripe will retry delivery.
3. Alternatively, replay manually:
   ```bash
   stripe events resend evt_XXXX --webhook-endpoint we_XXXX
   ```
   (requires Stripe CLI installed and authenticated)

### Rotating the webhook secret

1. In Stripe Dashboard → Webhooks → click endpoint → **Roll secret**.
2. Copy the new `whsec_...` value.
3. Update `STRIPE_WEBHOOK_SECRET` in Firebase Functions config:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_NEW"
   firebase deploy --only functions
   ```
4. Update `.env` locally and in `eas.json` if needed.

### Membership state discrepancies

If a user's app shows the wrong tier after a successful Stripe payment:

1. Check `stripeEvents` collection in Firestore — confirm the event was processed.
2. Check the user's `users/{uid}` doc — verify `membership.tier` and `membership.isActive`.
3. If Firestore is correct but the app shows old state, force a token refresh on the client:
   - User signs out and back in, or
   - Call `firebase.auth().currentUser?.getIdToken(true)` to force custom claim sync.
4. If Firestore is wrong, manually update via Firebase Console and re-deliver the webhook event.
