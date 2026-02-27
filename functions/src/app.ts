/**
 * CulturePassAU — Cloud Functions Express app
 *
 * Ported from server/index.ts with these changes:
 *   - auth middleware: Firebase Admin SDK verifyIdToken (not custom HS256)
 *   - GET /api/auth/me: reads from Firestore (not PostgreSQL)
 *   - POST /api/auth/register|login|refresh: removed (handled by Firebase Auth SDK client-side)
 *   - Image uploads: write to Firebase Storage (not local disk)
 *   - Static file serving: removed (handled by Firebase Hosting)
 *   - app.listen(): removed (Cloud Functions handles HTTP lifecycle)
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import multer from 'multer';
import sharp from 'sharp';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { db, storageBucket, authAdmin, isFirestoreConfigured } from './admin';
import { firestore } from 'firebase-admin';
import { moderationCheck, textHasProfanity } from './middleware/moderation';
import { authenticate, requireAuth, requireRole, isOwnerOrAdmin, type RequestUser } from './middleware/auth';
import {
  buildSearchCacheKey,
  runSearch,
  runSuggest,
  type SearchQuery,
  type SearchableItem,
  type SearchType,
} from './services/search';
import { getRolloutConfig, isFeatureEnabledForUser } from './services/rollout';
import { InMemoryTtlCache } from './services/cache';
import {
  eventsService,
  usersService,
  ticketsService,
  profilesService,
  walletsService,
  notificationsService,
  perksService,
  redemptionsService,
  reportsService,
  mediaService,
  eventFeedbackService,
  type FirestoreEvent,
  type FirestoreProfile,
} from './services/firestore';

// Stripe SDK — only initialised when STRIPE_SECRET_KEY is present
const stripeClient: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' as unknown as Stripe.LatestApiVersion })
  : null;

if (!stripeClient) {
  console.warn('[stripe] STRIPE_SECRET_KEY not set — Stripe endpoints are mocked.');
}

type EntityType = 'community' | 'business' | 'venue' | 'artist' | 'organisation';
type TicketStatus = 'confirmed' | 'used' | 'cancelled' | 'expired';
type TicketPriority = 'low' | 'normal' | 'high' | 'vip';
type MembershipTier = 'free' | 'plus' | 'premium' | 'elite' | 'pro' | 'vip';
type MembershipStatus = 'active' | 'inactive';
type RewardsTier = 'silver' | 'gold' | 'diamond';

type AppUser = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  city: string;
  country: string;
  bio?: string;
  avatarUrl?: string;
  socialLinks?: Record<string, string>;
  location?: string;
  culturePassId: string;
};

type AppEvent = {
  id: string;
  title: string;
  communityTag: string;
  venue: string;
  date: string;
  time: string;
  city: string;
  country: string;
  imageUrl?: string;
  imageColor?: string;
  description: string;
  cultureTag?: string[];
  geoHash?: string;
  eventType?: string;
  ageSuitability?: string;
  priceTier?: string;
  organizerReputationScore?: number;
  externalTicketUrl?: string | null;
  deletedAt?: string | null;
  address?: string;
  priceCents?: number;
  priceLabel?: string;
  category?: string;
  organizerId?: string;
  organizer?: string;
  capacity?: number;
  attending?: number;
  isFeatured?: boolean;
  isFree?: boolean;
  tiers?: Array<{ name: string; priceCents: number; available: number }>;
  tags?: string[];
  indigenousTags?: string[];
  languageTags?: string[];
  cpid?: string;
};

type AppProfile = {
  id: string;
  name: string;
  entityType: EntityType;
  category: string;
  city: string;
  country: string;
  description: string;
  imageUrl?: string;
  members?: number;
  followers?: number;
  verified?: boolean;
};

type AppTicket = {
  id: string;
  userId: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventVenue: string;
  tierName: string;
  quantity: number;
  totalPriceCents: number;
  currency: string;
  status: TicketStatus;
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
  priority: TicketPriority;
  ticketCode: string;
  scanCount?: number;
  lastScannedAt?: string;
  staffAuditTrail?: Array<{ at: string; by: string; action: string; note?: string }>;
  stripePaymentIntentId?: string;
  walletPasses?: { apple?: string; google?: string };
  cashbackCents?: number;
  cashbackCreditedAt?: string;
  rewardPointsEarned?: number;
  rewardPointsAwardedAt?: string;
  imageColor?: string;
  createdAt: string;
  history: Array<{ at: string; status: TicketStatus; note: string }>;
};

export const app = express();

// ---------------------------------------------------------------------------
// CORS — must be first middleware so preflight OPTIONS is handled before auth
// ---------------------------------------------------------------------------
app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  // Reflect the requesting origin back (supports credentials: 'include')
  res.setHeader('Access-Control-Allow-Origin', origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  // Short-circuit preflight
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
});

// Capture raw body for Stripe webhook signature verification.
app.use(
  express.json({
    limit: '2mb',
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      if (req.originalUrl === '/api/stripe/webhook') {
        req.rawBody = buf;
      }
    },
  })
);

// Parse Bearer tokens (Firebase ID tokens) on every request
app.use(authenticate);
app.use(attachDevUserIfNeeded);

// Rate limiting
app.use(rateLimit({
  windowMs: 60_000,
  max: 90,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}));

const searchCache = new InMemoryTtlCache(45_000);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const users: AppUser[] = [
  {
    id: 'u1',
    username: 'ramanarc',
    displayName: 'Raman Arc',
    email: 'raman@culturepass.au',
    city: 'Sydney',
    country: 'Australia',
    bio: 'Building human + AI community experiences.',
    location: 'Sydney, Australia',
    culturePassId: 'CP-U1',
    socialLinks: { instagram: 'ramanarc' },
  },
];

const events: AppEvent[] = [
  { id: 'e1', title: 'Startup Launch Night Sydney', communityTag: 'Startup', venue: 'Sydney CBD', date: '2026-03-15', time: '18:00', city: 'Sydney', country: 'Australia', description: 'Networking + founder demos.', imageColor: '#E85D3A' },
  { id: 'e2', title: 'Bollywood Beats Festival', communityTag: 'Indian', venue: 'Parramatta Park', date: '2026-04-02', time: '17:30', city: 'Sydney', country: 'Australia', description: 'Music, dance, and food.', imageColor: '#9B59B6' },
];

const profiles: AppProfile[] = [
  { id: 'c1', name: 'Sydney Startup Circle', entityType: 'community', category: 'Tech', city: 'Sydney', country: 'Australia', description: 'Founders and builders community.', members: 850, verified: true },
  { id: 'b1', name: 'RamanArc Studios', entityType: 'business', category: 'Studio', city: 'Sydney', country: 'Australia', description: 'Digital experiences for culture + community.', followers: 450, verified: true },
];

const privacySettings = new Map<string, Record<string, boolean>>();
const wallets = new Map<string, { id: string; userId: string; balance: number; currency: string; points: number }>();
const memberships = new Map<string, { id: string; userId: string; tier: MembershipTier; isActive: boolean; validUntil?: string }>();
const notifications = new Map<string, Array<{ id: string; userId: string; title: string; message: string; type: string; isRead: boolean; metadata: Record<string, unknown> | null; createdAt: string }>>();
const tickets: AppTicket[] = [];
const paymentMethods = new Map<string, Array<{ id: string; brand: string; last4: string; isDefault: boolean }>>();
const transactions = new Map<string, Array<{ id: string; type: 'charge' | 'refund' | 'debit' | 'cashback'; amountCents: number; createdAt: string; description: string }>>();
const scanEvents: Array<{ id: string; ticketId: string; ticketCode: string; scannedAt: string; scannedBy: string; outcome: 'accepted' | 'duplicate' | 'rejected' }> = [];

const culturalTagStore: Array<{ id: string; name: string; slug: string; category: string; iconUrl?: string }> = [
  { id: 'ct1', name: 'Malayali', slug: 'malayali', category: 'diaspora' },
  { id: 'ct2', name: 'Tamil', slug: 'tamil', category: 'diaspora' },
  { id: 'ct3', name: 'Sikh', slug: 'sikh', category: 'religious' },
  { id: 'ct4', name: 'Punjabi', slug: 'punjabi', category: 'diaspora' },
  { id: 'ct5', name: 'Indigenous', slug: 'indigenous', category: 'indigenous' },
  { id: 'ct6', name: 'Aboriginal', slug: 'aboriginal', category: 'indigenous' },
  { id: 'ct7', name: 'Filipino', slug: 'filipino', category: 'diaspora' },
  { id: 'ct8', name: 'Chinese', slug: 'chinese', category: 'diaspora' },
  { id: 'ct9', name: 'Vietnamese', slug: 'vietnamese', category: 'diaspora' },
  { id: 'ct10', name: 'Sri Lankan', slug: 'sri-lankan', category: 'diaspora' },
  { id: 'ct11', name: 'Telugu', slug: 'telugu', category: 'diaspora' },
  { id: 'ct12', name: 'Bengali', slug: 'bengali', category: 'diaspora' },
  { id: 'ct13', name: 'South Asian', slug: 'south-asian', category: 'regional' },
  { id: 'ct14', name: 'Startup', slug: 'startup', category: 'community' },
  { id: 'ct15', name: 'Indian', slug: 'indian', category: 'diaspora' },
];

const recommendationProfiles = new Map<string, { culturalTagWeights: Record<string, number>; eventTypeWeights: Record<string, number> }>();
const discoveryFeedbackStore: Array<{ userId: string; eventId: string; signal: 'up' | 'down'; createdAt: string }> = [];
const eventFeedbackStore: Array<{ id: string; eventId: string; userId: string; rating: number; comment?: string; createdAt: string }> = [];

type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';
type ContentReport = {
  id: string;
  targetType: 'event' | 'community' | 'profile' | 'post' | 'user';
  targetId: string;
  reason: string;
  details?: string;
  reporterUserId?: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  moderationNotes?: string;
};
type UploadedMedia = {
  id: string;
  targetType: 'user' | 'profile' | 'event' | 'business' | 'post';
  targetId: string;
  imageUrl: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  createdAt: string;
};

const perks: Array<{
  id: string;
  title: string;
  description: string;
  perkType: string;
  discountPercent: number | null;
  discountFixedCents: number | null;
  providerType: string;
  providerId: string;
  providerName: string;
  category: string;
  isMembershipRequired: boolean;
  requiredMembershipTier: string;
  usageLimit: number | null;
  usedCount: number;
  perUserLimit: number | null;
  status: string;
  startDate: string;
  endDate: string | null;
}> = [
  { id: 'p1', title: '20% Off Partner Cafes', description: 'Save on selected Sydney partner cafes.', perkType: 'discount_percent', discountPercent: 20, discountFixedCents: null, providerType: 'business', providerId: 'b1', providerName: 'RamanArc Studios', category: 'dining', isMembershipRequired: false, requiredMembershipTier: 'free', usageLimit: 500, usedCount: 34, perUserLimit: 2, status: 'active', startDate: new Date().toISOString(), endDate: null },
  { id: 'p2', title: 'VIP Event Priority Entry', description: 'Skip the queue at selected community events.', perkType: 'vip_upgrade', discountPercent: null, discountFixedCents: null, providerType: 'event', providerId: 'e1', providerName: 'CulturePass Events', category: 'events', isMembershipRequired: true, requiredMembershipTier: 'plus', usageLimit: null, usedCount: 10, perUserLimit: 1, status: 'active', startDate: new Date().toISOString(), endDate: null },
];

const redemptions = new Map<string, Array<{ id: string; perkId: string; userId: string; redeemedAt: string }>>();
const reports: ContentReport[] = [];
const uploadedMedia: UploadedMedia[] = [];

for (const user of users) {
  wallets.set(user.id, { id: `w-${user.id}`, userId: user.id, balance: 12500, currency: 'AUD', points: 1200 });
  memberships.set(user.id, { id: `m-${user.id}`, userId: user.id, tier: 'free', isActive: true });
  privacySettings.set(user.id, { profileVisible: true, showEmail: false, showPhone: false, searchable: true });
  notifications.set(user.id, [
    { id: randomUUID(), userId: user.id, title: 'Welcome to CulturePass', message: 'Your account is ready.', type: 'system', isRead: false, metadata: null, createdAt: new Date().toISOString() },
  ]);
  paymentMethods.set(user.id, [{ id: randomUUID(), brand: 'visa', last4: '4242', isDefault: true }]);
  transactions.set(user.id, []);
}

function nowIso() {
  return new Date().toISOString();
}

const FALLBACK_EVENT_TIMESTAMP = nowIso();
const fallbackEvents: FirestoreEvent[] = events.map((event) => ({
  id: event.id,
  title: event.title,
  description: event.description,
  communityTag: event.communityTag ?? 'General',
  venue: event.venue,
  date: event.date,
  time: event.time ?? '',
  city: event.city,
  country: event.country,
  imageUrl: event.imageUrl,
  imageColor: event.imageColor,
  category: event.category ?? event.communityTag ?? 'Culture',
  organizer: event.organizer,
  organizerId: event.organizerId,
  organizerReputationScore: event.organizerReputationScore,
  capacity: event.capacity,
  attending: event.attending,
  isFeatured: event.isFeatured ?? false,
  isFree: event.isFree ?? true,
  tiers: event.tiers,
  tags: event.tags,
  cultureTag: event.cultureTag,
  indigenousTags: event.indigenousTags,
  languageTags: event.languageTags,
  priceCents: event.priceCents,
  priceLabel: event.priceLabel,
  status: 'published',
  createdAt: FALLBACK_EVENT_TIMESTAMP,
  updatedAt: FALLBACK_EVENT_TIMESTAMP,
}));
const fallbackEventLookup = new Map(fallbackEvents.map((event) => [event.id, event]));
const hasFirestoreProject = isFirestoreConfigured;
const MEMBERSHIP_PAID_TIERS: MembershipTier[] = ['plus', 'premium', 'elite', 'pro', 'vip'];
const MEMBERSHIP_PLAN_CONFIG: Record<MembershipTier, {
  label: string;
  cashbackRate: number;
  earlyAccessHours: number;
}> = {
  free: { label: 'Free', cashbackRate: 0, earlyAccessHours: 0 },
  plus: { label: 'Plus', cashbackRate: 0.02, earlyAccessHours: 48 },
  premium: { label: 'Premium', cashbackRate: 0.03, earlyAccessHours: 72 },
  elite: { label: 'Elite', cashbackRate: 0.04, earlyAccessHours: 72 },
  pro: { label: 'Pro', cashbackRate: 0.03, earlyAccessHours: 48 },
  vip: { label: 'VIP', cashbackRate: 0.05, earlyAccessHours: 96 },
};
const REWARDS_TIERS: Array<{ tier: RewardsTier; minPoints: number; label: string }> = [
  { tier: 'diamond', minPoints: 5000, label: 'Diamond' },
  { tier: 'gold', minPoints: 1000, label: 'Gold' },
  { tier: 'silver', minPoints: 0, label: 'Silver' },
];
const POINTS_PER_DOLLAR = 1;
const devUser: RequestUser = {
  id: users[0].id,
  username: users[0].username,
  email: users[0].email,
  role: 'admin',
  city: users[0].city,
  country: users[0].country,
};

function respondWithFallbackEvents(res: Response) {
  const length = fallbackEvents.length;
  return res.json({
    events: fallbackEvents,
    total: length,
    page: 1,
    pageSize: length,
    hasNextPage: false,
  });
}

function attachDevUserIfNeeded(req: Request, _res: Response, next: NextFunction) {
  if (!hasFirestoreProject && !req.user) {
    req.user = devUser;
  }
  next();
}

/** Safely extract a single string from an Express query param. */
function qstr(v: unknown): string {
  if (Array.isArray(v)) return String(v[0] ?? '');
  return String(v ?? '');
}

/** Safely extract a route param — Express v5 types param values as string | string[]. */
function qparam(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? '';
  return v ?? '';
}

function normalizeMembershipTier(tier: unknown): MembershipTier {
  const value = String(tier ?? 'free').toLowerCase() as MembershipTier;
  return value in MEMBERSHIP_PLAN_CONFIG ? value : 'free';
}

function isMembershipActive(tier: MembershipTier, isActive?: boolean, expiresAt?: string | null): boolean {
  if (tier === 'free') return false;
  if (isActive === false) return false;
  if (!expiresAt) return true;
  return new Date(expiresAt).getTime() > Date.now();
}

function buildMembershipResponse(params: {
  tier?: unknown;
  isActive?: boolean;
  expiresAt?: string | null;
  eventsAttended?: number;
}) {
  const tier = normalizeMembershipTier(params.tier);
  const config = MEMBERSHIP_PLAN_CONFIG[tier];
  const active = isMembershipActive(tier, params.isActive, params.expiresAt);
  const status: MembershipStatus = active ? 'active' : 'inactive';
  const cashbackRate = active ? config.cashbackRate : 0;
  return {
    tier,
    tierLabel: config.label,
    status,
    expiresAt: params.expiresAt ?? null,
    cashbackRate,
    cashbackMultiplier: 1 + cashbackRate,
    earlyAccessHours: active ? config.earlyAccessHours : 0,
    eventsAttended: Number(params.eventsAttended ?? 0),
  };
}

function calculateRewardPoints(amountCents: number): number {
  const dollars = Math.floor(Math.max(0, Number(amountCents ?? 0)) / 100);
  return Math.max(0, dollars * POINTS_PER_DOLLAR);
}

function buildRewardsStatus(pointsInput: unknown) {
  const points = Math.max(0, Math.floor(Number(pointsInput ?? 0)));
  const currentTier = REWARDS_TIERS.find((tier) => points >= tier.minPoints) ?? REWARDS_TIERS[REWARDS_TIERS.length - 1];
  const orderedAsc = [...REWARDS_TIERS].sort((a, b) => a.minPoints - b.minPoints);
  const currentIndex = orderedAsc.findIndex((tier) => tier.tier === currentTier.tier);
  const nextTier = currentIndex >= 0 ? orderedAsc[currentIndex + 1] : null;
  const pointsToNextTier = nextTier ? Math.max(0, nextTier.minPoints - points) : 0;
  const progressPercent = nextTier
    ? Math.min(
        100,
        Math.max(
          0,
          Math.round(
            ((points - currentTier.minPoints) / Math.max(1, nextTier.minPoints - currentTier.minPoints)) * 100
          )
        )
      )
    : 100;
  return {
    points,
    pointsPerDollar: POINTS_PER_DOLLAR,
    tier: currentTier.tier,
    tierLabel: currentTier.label,
    nextTier: nextTier?.tier ?? null,
    nextTierLabel: nextTier?.label ?? null,
    pointsToNextTier,
    progressPercent,
  };
}

async function awardRewardsPoints(
  userId: string,
  amountCents: number,
  context: { ticketId?: string; source: string }
): Promise<number> {
  const points = calculateRewardPoints(amountCents);
  if (points <= 0) return 0;

  if (hasFirestoreProject) {
    await walletsService.addPoints(userId, points);
    try {
      await notificationsService.create({
        userId,
        title: 'Reward points earned',
        message: `+${points} points from ${context.source}.`,
        type: 'rewards_points',
        isRead: false,
        metadata: {
          ticketId: context.ticketId ?? null,
          points,
          source: context.source,
        },
        createdAt: nowIso(),
      });
    } catch (err) {
      console.error('[rewards] notification create failed:', err);
    }
    return points;
  }

  const wallet = wallets.get(userId);
  if (wallet) {
    wallet.points = Number(wallet.points ?? 0) + points;
  } else {
    wallets.set(userId, { id: `w-${userId}`, userId, balance: 0, currency: 'AUD', points });
  }
  return points;
}

type RawWalletTransaction = {
  id: string;
  type: 'charge' | 'refund' | 'debit' | 'cashback';
  amountCents: number;
  createdAt: string;
  description: string;
};

function toTransactionApiRecord(
  userId: string,
  currency: string,
  tx: RawWalletTransaction,
) {
  const mappedType = tx.type === 'debit'
    ? 'payment'
    : tx.type === 'cashback'
      ? 'cashback'
      : tx.type === 'refund'
        ? 'refund'
        : 'topup';
  const signedAmount = mappedType === 'payment'
    ? -Math.abs(tx.amountCents) / 100
    : Math.abs(tx.amountCents) / 100;
  return {
    id: tx.id,
    userId,
    type: mappedType,
    amount: Number(signedAmount.toFixed(2)),
    amountCents: Math.abs(tx.amountCents),
    currency,
    description: tx.description,
    status: 'completed',
    category: mappedType === 'payment' ? 'tickets' : 'wallet',
    metadata: null,
    createdAt: tx.createdAt,
  };
}

function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Invalid request body');
  }
  return parsed.data;
}

const walletTopupSchema = z.object({
  amount: z.coerce.number().positive(),
});

const membershipSubscribeSchema = z.object({
  billingPeriod: z.enum(['monthly', 'yearly']).default('monthly'),
});

const createPerkSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  perkType: z.string().min(1),
  category: z.string().min(1),
  providerName: z.string().optional(),
  providerType: z.string().optional(),
  providerId: z.string().optional(),
  discountPercent: z.number().nullable().optional(),
  discountFixedCents: z.number().nullable().optional(),
  isMembershipRequired: z.boolean().optional(),
  requiredMembershipTier: z.string().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  endDate: z.string().nullable().optional(),
});

const mediaAttachSchema = z.object({
  targetType: z.enum(['user', 'profile', 'event', 'business', 'post']),
  targetId: z.string().min(1),
  imageUrl: z.string().min(1),
  thumbnailUrl: z.string().min(1),
  width: z.coerce.number().int().nonnegative().optional(),
  height: z.coerce.number().int().nonnegative().optional(),
});

const reportCreateSchema = z.object({
  targetType: z.enum(['event', 'community', 'profile', 'post', 'user']),
  targetId: z.string().min(1),
  reason: z.string().min(1),
  details: z.string().optional(),
});

const reportReviewSchema = z.object({
  status: z.enum(['pending', 'reviewing', 'resolved', 'dismissed']).default('reviewing'),
  moderationNotes: z.string().optional(),
});

const eventFeedbackSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().optional(),
});

const stripeCheckoutSchema = z.object({
  ticketData: z.object({
    eventId: z.string().min(1),
    eventTitle: z.string().optional(),
    eventDate: z.string().optional(),
    eventTime: z.string().optional(),
    eventVenue: z.string().optional(),
    tierName: z.string().optional(),
    quantity: z.coerce.number().int().positive().optional(),
    totalPriceCents: z.coerce.number().int().nonnegative().optional(),
    currency: z.string().optional(),
    imageColor: z.string().optional(),
  }),
});

const stripeRefundSchema = z.object({
  ticketId: z.string().min(1),
});

function parseSearchQuery(req: Request): SearchQuery {
  const tagsInput = String(req.query.tags ?? '').trim();
  const tags = tagsInput ? tagsInput.split(',').map((tag) => tag.trim()).filter(Boolean) : [];
  return {
    q: String(req.query.q ?? '').trim(),
    type: (String(req.query.type ?? 'all').toLowerCase() as SearchType) || 'all',
    city: String(req.query.city ?? '').trim() || undefined,
    country: String(req.query.country ?? '').trim() || undefined,
    tags,
    startDate: String(req.query.startDate ?? '').trim() || undefined,
    endDate: String(req.query.endDate ?? '').trim() || undefined,
    page: Math.max(1, Number(req.query.page ?? 1)),
    pageSize: Math.min(50, Math.max(1, Number(req.query.pageSize ?? 20))),
  };
}

function getSearchCorpus(): SearchableItem[] {
  const eventItems: SearchableItem[] = events.map((event) => ({
    id: event.id,
    type: 'event',
    title: event.title,
    subtitle: `${event.communityTag} · ${event.venue}`,
    description: event.description,
    city: event.city,
    country: event.country,
    tags: [event.communityTag],
    date: event.date,
  }));
  const profileItems: SearchableItem[] = profiles.map((profile) => ({
    id: profile.id,
    type: profile.entityType === 'business' ? 'business' : 'profile',
    title: profile.name,
    subtitle: `${profile.category} · ${profile.city}`,
    description: profile.description,
    city: profile.city,
    country: profile.country,
    tags: [profile.category, profile.entityType],
  }));
  const communityItems: SearchableItem[] = profiles
    .filter((profile) => profile.entityType === 'community')
    .map((profile) => ({
      id: profile.id,
      type: 'community',
      title: profile.name,
      subtitle: `${profile.category} · ${profile.members ?? 0} members`,
      description: profile.description,
      city: profile.city,
      country: profile.country,
      tags: [profile.category, 'community'],
    }));
  return [...eventItems, ...profileItems, ...communityItems];
}

// ---------------------------------------------------------------------------
// Health + status
// ---------------------------------------------------------------------------

app.get('/health', (_req, res) => res.json({ ok: true, at: nowIso() }));
app.get('/status', (_req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------------------
// Auth routes — /api/auth/*
// POST /register and /login are handled client-side via Firebase Auth SDK.
// Only GET /me is needed here to fetch full user profile.
// ---------------------------------------------------------------------------

app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.id;
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (snap.exists) {
      return res.json({ id: uid, role: req.user!.role, ...snap.data() });
    }
    // Fallback: return minimal profile from token claims
    return res.json({
      id: uid,
      role: req.user!.role,
      username: req.user!.username,
      email: req.user!.email,
      city: req.user!.city,
      country: req.user!.country,
    });
  } catch (err) {
    console.error('[auth/me]:', err);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// POST /api/auth/register — create Firestore profile after Firebase Auth account creation
app.post('/api/auth/register', requireAuth, async (req: Request, res: Response) => {
  const uid = req.user!.id;
  const { displayName, city, country, username } = req.body ?? {};
  try {
    const snap = await db.collection('users').doc(uid).get();
    if (!snap.exists) {
      const profile = {
        username: username ?? req.user!.username,
        displayName: displayName ?? req.user!.username,
        email: req.user!.email ?? null,
        city: city ?? null,
        country: country ?? null,
        culturePassId: `CP-U${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
        createdAt: nowIso(),
      };
      await db.collection('users').doc(uid).set(profile);
      // Bootstrap wallet, membership, welcome notification, and custom claims
      await Promise.all([
        db.collection('users').doc(uid).collection('wallet').doc('main').set({ balanceCents: 0, currency: 'AUD', points: 0 }),
        db.collection('users').doc(uid).collection('membership').doc('current').set({ tier: 'free', isActive: true }),
        db.collection('notifications').add({ userId: uid, title: 'Welcome to CulturePass!', message: 'Your account is ready.', type: 'system', isRead: false, createdAt: nowIso() }),
        // Set Firebase custom claims so the auth middleware reads correct role/tier
        authAdmin.setCustomUserClaims(uid, {
          role: 'user',
          tier: 'free',
          ...(city && { city: String(city) }),
          ...(country && { country: String(country) }),
          username: profile.username,
        }),
      ]);
      return res.status(201).json({ id: uid, ...profile });
    }
    return res.json({ id: uid, ...snap.data() });
  } catch (err) {
    console.error('[auth/register]:', err);
    return res.status(500).json({ error: 'Profile creation failed' });
  }
});

// ---------------------------------------------------------------------------
// Rollout config
// ---------------------------------------------------------------------------

app.get('/api/rollout/config', (req, res) => {
  const userId = String(req.query.userId ?? 'guest');
  const rollout = getRolloutConfig();
  res.json({
    rollout,
    flags: {
      ticketingPhase6: isFeatureEnabledForUser('ticketingPhase6', userId),
      mediaPipelinePhase4: isFeatureEnabledForUser('mediaPipelinePhase4', userId),
      governancePhase3: isFeatureEnabledForUser('governancePhase3', userId),
    },
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get('/api/users', async (_req, res) => {
  if (hasFirestoreProject) {
    try {
      const snap = await db.collection('users').limit(100).get();
      return res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch users' });
    }
  }
  return res.json(users);
});

app.get('/api/users/:id', async (req, res) => {
  if (!hasFirestoreProject) {
    const user = users.find((item) => item.id === qparam(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  }

  try {
    const user = await usersService.getById(qparam(req.params.id));
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json(user);
  } catch (err) {
    console.error('[GET /api/users/:id]:', err);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

app.put('/api/users/:id', requireAuth, moderationCheck, async (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.id))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (textHasProfanity(req.body?.displayName) || textHasProfanity(req.body?.bio)) {
    return res.status(400).json({ error: 'Profile content failed moderation' });
  }

  if (!hasFirestoreProject) {
    const idx = users.findIndex((item) => item.id === qparam(req.params.id));
    if (idx === -1) return res.status(404).json({ error: 'User not found' });
    const current = users[idx];
    users[idx] = { ...current, ...req.body, id: current.id, culturePassId: current.culturePassId };
    return res.json(users[idx]);
  }

  try {
    const updated = await usersService.upsert(qparam(req.params.id), req.body);
    return res.json(updated);
  } catch (err) {
    console.error('[PUT /api/users/:id]:', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// ---------------------------------------------------------------------------
// Admin — seed demo data (protected by SEED_SECRET header, one-shot)
// ---------------------------------------------------------------------------

app.post('/api/admin/seed', async (req, res) => {
  const secret = process.env.SEED_SECRET;
  if (!secret || req.headers['x-seed-secret'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const nowTs = new Date().toISOString();
  const soon = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const SEED_EVENTS = [
    { title: 'Sydney Kerala Cultural Festival 2026', description: 'The biggest Malayalam cultural gathering in the Southern Hemisphere. Live music, Kathakali dance, traditional cuisine, and community awards. Families welcome.', communityTag: 'Malayalam', venue: 'Darling Harbour Convention Centre', address: '14 Darling Dr, Sydney NSW 2000', date: soon(14), time: '10:00 AM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1598300056393-4aac492f4344?w=800', imageColor: '#E8472A', cultureTag: ['Kerala', 'Malayalam', 'South Indian'], tags: ['festival', 'culture', 'family', 'dance'], category: 'Festival', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'mid', priceCents: 2500, priceLabel: '$25', isFree: false, isFeatured: true, capacity: 2000, attending: 847, organizerId: 'seed-org-1', organizer: 'Kerala Community Sydney', organizerReputationScore: 92, status: 'published' as const, cpid: 'CP-E-KCFSYD', tiers: [{ name: 'General', priceCents: 2500, available: 1200 }, { name: 'Family Pack (4)', priceCents: 8000, available: 200 }, { name: 'VIP', priceCents: 7500, available: 50 }] },
    { title: 'Tamil Pongal Celebration — Sydney', description: 'Join us to celebrate the harvest festival of Pongal with traditional kolam art, music, delicious food, and a bonfire ceremony.', communityTag: 'Tamil', venue: 'Parramatta Town Hall', address: '182 Church St, Parramatta NSW 2150', date: soon(7), time: '09:00 AM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1606298855672-3efb63017be8?w=800', imageColor: '#F59E0B', cultureTag: ['Tamil', 'South Indian'], tags: ['pongal', 'harvest', 'family'], category: 'Cultural', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'free', priceCents: 0, priceLabel: 'Free', isFree: true, isFeatured: true, capacity: 800, attending: 412, organizerId: 'seed-org-2', organizer: 'Tamil Sangam NSW', organizerReputationScore: 88, status: 'published' as const, cpid: 'CP-E-PONGSYD', tiers: [] },
    { title: 'Bollywood Night — Live DJ & Dance', description: 'The hottest Bollywood party in Sydney! Dance the night away with live DJ sets, costume competition, and authentic cocktails.', communityTag: 'Bollywood', venue: 'The Star Event Centre', address: '80 Pyrmont St, Pyrmont NSW 2009', date: soon(21), time: '08:00 PM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800', imageColor: '#7C3AED', cultureTag: ['Bollywood', 'South Asian', 'Hindi'], tags: ['party', 'dance', 'dj', 'nightlife'], category: 'Nightlife', eventType: 'In-Person', ageSuitability: '18+', priceTier: 'mid', priceCents: 3500, priceLabel: '$35', isFree: false, isFeatured: true, capacity: 600, attending: 521, organizerId: 'seed-org-3', organizer: 'Desi Nights Sydney', organizerReputationScore: 85, status: 'published' as const, cpid: 'CP-E-BNISYD', tiers: [{ name: 'Standard', priceCents: 3500, available: 400 }, { name: 'VIP Table', priceCents: 15000, available: 20 }] },
    { title: 'Filipino Cultural Showcase — Sinulog Sydney', description: 'Celebrate the Sinulog Festival with traditional Cebuano street dancing, lechon feast, Filipino arts and crafts market.', communityTag: 'Filipino', venue: 'Sydney Olympic Park', address: 'Olympic Blvd, Sydney Olympic Park NSW 2127', date: soon(30), time: '11:00 AM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?w=800', imageColor: '#EF4444', cultureTag: ['Filipino', 'Cebuano', 'Southeast Asian'], tags: ['festival', 'dance', 'food', 'sinulog'], category: 'Festival', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'low', priceCents: 1500, priceLabel: '$15', isFree: false, isFeatured: false, capacity: 1000, attending: 234, organizerId: 'seed-org-4', organizer: 'Fil-Oz Cultural Foundation', organizerReputationScore: 79, status: 'published' as const, cpid: 'CP-E-FILSYD', tiers: [{ name: 'Adult', priceCents: 1500, available: 700 }, { name: 'Child (under 12)', priceCents: 500, available: 200 }] },
    { title: 'Chinese New Year — Dragon Dance Parade', description: 'Ring in the Year of the Snake with spectacular dragon and lion dances through Chinatown, followed by a lantern festival and dumpling-making workshops.', communityTag: 'Chinese', venue: 'Sydney Chinatown', address: 'Dixon St, Haymarket NSW 2000', date: soon(10), time: '06:00 PM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=800', imageColor: '#DC2626', cultureTag: ['Chinese', 'East Asian'], tags: ['new year', 'parade', 'lantern', 'family'], category: 'Festival', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'free', priceCents: 0, priceLabel: 'Free', isFree: true, isFeatured: true, capacity: 5000, attending: 3211, organizerId: 'seed-org-5', organizer: 'Sydney Chinese Community Association', organizerReputationScore: 96, status: 'published' as const, cpid: 'CP-E-CNYSYD', tiers: [] },
    { title: 'Nigerian Independence Day Gala', description: 'Celebrate 66 years of Nigerian independence with Afrobeat live performances, jollof cook-off, fashion showcase, and traditional masquerade.', communityTag: 'Nigerian', venue: 'Doltone House Hyde Park', address: '181 Elizabeth St, Sydney NSW 2000', date: soon(45), time: '07:00 PM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1566753323558-f4e0952af115?w=800', imageColor: '#16A34A', cultureTag: ['Nigerian', 'African', 'Afrobeat'], tags: ['independence', 'gala', 'music', 'food'], category: 'Gala', eventType: 'In-Person', ageSuitability: '18+', priceTier: 'premium', priceCents: 8500, priceLabel: '$85', isFree: false, isFeatured: false, capacity: 300, attending: 187, organizerId: 'seed-org-6', organizer: 'Nigerian Community Australia', organizerReputationScore: 82, status: 'published' as const, cpid: 'CP-E-NIGSYD', tiers: [{ name: 'Standard', priceCents: 8500, available: 200 }, { name: 'VIP', priceCents: 20000, available: 30 }] },
    { title: 'Greek Easter — Panigiri Festival', description: 'Traditional Greek Easter celebration with live bouzouki music, traditional dancing lessons, souvlaki feast, and Orthodox Easter ceremony.', communityTag: 'Greek', venue: 'Rockdale Town Hall', address: '2 Bryant St, Rockdale NSW 2216', date: soon(18), time: '05:00 PM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800', imageColor: '#1D4ED8', cultureTag: ['Greek', 'Mediterranean', 'European'], tags: ['easter', 'panigiri', 'music', 'dance', 'food'], category: 'Cultural', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'low', priceCents: 2000, priceLabel: '$20', isFree: false, isFeatured: false, capacity: 500, attending: 302, organizerId: 'seed-org-7', organizer: 'Hellenic Community of NSW', organizerReputationScore: 91, status: 'published' as const, cpid: 'CP-E-GRKSYD', tiers: [{ name: 'General', priceCents: 2000, available: 400 }] },
    { title: 'Indigenous Storytelling Night — NAIDOC Week', description: 'An intimate evening of First Nations storytelling, traditional music, and art featuring local Gadigal artists. Proceeds go to local indigenous youth programs.', communityTag: 'Aboriginal', venue: 'Carriageworks', address: '245 Wilson St, Eveleigh NSW 2015', date: soon(35), time: '07:30 PM', city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800', imageColor: '#92400E', cultureTag: ['Aboriginal', 'First Nations', 'Indigenous'], indigenousTags: ['Gadigal', 'Naidoc'], tags: ['storytelling', 'art', 'naidoc', 'cultural'], category: 'Arts', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'low', priceCents: 1500, priceLabel: '$15', isFree: false, isFeatured: true, capacity: 200, attending: 156, organizerId: 'seed-org-8', organizer: 'Gadigal Art Collective', organizerReputationScore: 94, status: 'published' as const, cpid: 'CP-E-INDSYD', tiers: [{ name: 'General', priceCents: 1500, available: 100 }] },
    { title: 'Melbourne Diwali Lights Festival', description: 'The city of Melbourne lights up for Diwali! Join thousands for the spectacular Federation Square light show, rangoli competition, and South Asian street food.', communityTag: 'South Asian', venue: 'Federation Square', address: 'Corner of Flinders & Swanston St, Melbourne VIC 3000', date: soon(12), time: '07:00 PM', city: 'Melbourne', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1467810563316-b5476525c0f9?w=800', imageColor: '#F97316', cultureTag: ['South Asian', 'Hindu', 'Diwali'], tags: ['diwali', 'lights', 'festival', 'outdoor'], category: 'Festival', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'free', priceCents: 0, priceLabel: 'Free', isFree: true, isFeatured: true, capacity: 10000, attending: 7234, organizerId: 'seed-org-9', organizer: 'Festival of India Melbourne', organizerReputationScore: 97, status: 'published' as const, cpid: 'CP-E-DIVMLB', tiers: [] },
    { title: 'Vietnamese Tet New Year Market', description: "Celebrate Lunar New Year with the Vietnamese community. Traditional music, ao dai fashion show, bánh mì cook-off, and children's activities.", communityTag: 'Vietnamese', venue: 'Springvale Town Centre', address: 'Springvale Rd, Springvale VIC 3171', date: soon(8), time: '10:00 AM', city: 'Melbourne', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800', imageColor: '#FBBF24', cultureTag: ['Vietnamese', 'Southeast Asian'], tags: ['tet', 'new year', 'market', 'food'], category: 'Market', eventType: 'In-Person', ageSuitability: 'All Ages', priceTier: 'free', priceCents: 0, priceLabel: 'Free', isFree: true, isFeatured: false, capacity: 3000, attending: 1876, organizerId: 'seed-org-10', organizer: 'Vietnamese Community Australia', organizerReputationScore: 87, status: 'published' as const, cpid: 'CP-E-TETMLB', tiers: [] },
  ];

  try {
    const batch = db.batch();
    let count = 0;
    for (const event of SEED_EVENTS) {
      const ref = db.collection('events').doc();
      batch.set(ref, { ...event, id: ref.id, createdAt: nowTs, updatedAt: nowTs });
      count++;
    }
    await batch.commit();
    return res.json({ seeded: count, ok: true });
  } catch (err) {
    console.error('[admin/seed]:', err);
    return res.status(500).json({ error: 'Seed failed', detail: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// GET /api/events — list published events with optional filtering + pagination
app.get('/api/events', async (req, res) => {
  try {
    const city         = qstr(req.query.city).trim()         || undefined;
    const country      = qstr(req.query.country).trim()      || undefined;
    const category     = qstr(req.query.category).trim()     || undefined;
    const eventType    = qstr(req.query.eventType).trim()    || undefined;
    const dateFrom     = qstr(req.query.dateFrom).trim()     || undefined;
    const dateTo       = qstr(req.query.dateTo).trim()       || undefined;
    const organizerId  = qstr(req.query.organizerId).trim()  || undefined;
    const isFeatured = qstr(req.query.isFeatured) === 'true' ? true : undefined;
    const page       = Math.max(1, parseInt(qstr(req.query.page)    || '1',  10) || 1);
    const pageSize   = Math.min(100, Math.max(1, parseInt(qstr(req.query.pageSize) || '20', 10) || 20));
    const filtersApplied = [city, country, category, eventType, dateFrom, dateTo, isFeatured, organizerId].some(
      (value) => value != null
    );

    if (!hasFirestoreProject) {
      return respondWithFallbackEvents(res);
    }

    const result = await eventsService.list(
      { city, country, category, eventType, dateFrom, dateTo, isFeatured, organizerId },
      { page, pageSize }
    );

    if (result.items.length === 0 && !filtersApplied) {
      return respondWithFallbackEvents(res);
    }

    return res.json({
      events: result.items,
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasNextPage: result.hasNextPage,
    });
  } catch (err) {
    console.error('[GET /api/events]:', err);
    if (!hasFirestoreProject) {
      return respondWithFallbackEvents(res);
    }
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/cross-community — events tagged with 2+ culture tags
app.get('/api/events/cross-community', async (_req, res) => {
  try {
    const result = await eventsService.list({ status: 'published' }, { page: 1, pageSize: 50 });
    const cross = result.items.filter((e) => (e.cultureTag?.length ?? 0) >= 2);
    return res.json(cross);
  } catch (err) {
    console.error('[GET /api/events/cross-community]:', err);
    return res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// GET /api/events/:id
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await eventsService.getById(qparam(req.params.id));
    if (!event) {
      const fallback = fallbackEventLookup.get(qparam(req.params.id));
      if (fallback) return res.json(fallback);
      return res.status(404).json({ error: 'Event not found' });
    }
    return res.json(event);
  } catch (err) {
    console.error('[GET /api/events/:id]:', err);
    if (!hasFirestoreProject) {
      const fallback = fallbackEventLookup.get(qparam(req.params.id));
      if (fallback) return res.json(fallback);
    }
    return res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// POST /api/events — create new event (organizer or admin)
app.post('/api/events', requireAuth, requireRole('organizer', 'admin'), moderationCheck, async (req, res) => {
  const b = req.body ?? {};
  if (!b.title || !b.date || !b.city || !b.country) {
    return res.status(400).json({ error: 'title, date, city, and country are required' });
  }

  if (!hasFirestoreProject) {
    const newEvent: AppEvent = {
      id: `e-dev-${Date.now()}`,
      title: String(b.title),
      communityTag: String(b.communityTag ?? 'General'),
      venue: String(b.venue ?? ''),
      date: String(b.date),
      time: String(b.time ?? ''),
      city: String(b.city),
      country: String(b.country),
      description: String(b.description ?? ''),
      imageUrl: b.imageUrl ? String(b.imageUrl) : undefined,
      priceCents: b.priceCents ? Number(b.priceCents) : 0,
      organizerId: req.user!.id,
      organizer: req.user!.username,
      isFree: b.isFree ?? false,
      isFeatured: b.isFeatured ?? false,
    };
    const newFirestoreEvent: FirestoreEvent = {
      ...newEvent,
      status: 'draft',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    events.push(newEvent);
    fallbackEvents.push(newFirestoreEvent);
    fallbackEventLookup.set(newEvent.id, newFirestoreEvent);
    return res.status(201).json(newFirestoreEvent);
  }

  try {
    const event = await eventsService.create({
      title:       String(b.title),
      description: String(b.description ?? ''),
      communityTag: String(b.communityTag ?? (Array.isArray(b.cultureTag) ? b.cultureTag[0] : '') ?? ''),
      venue:    String(b.venue ?? ''),
      address:  b.address   ? String(b.address) : undefined,
      date:     String(b.date),
      time:     String(b.time ?? ''),
      city:     String(b.city),
      country:  String(b.country),
      imageUrl: b.imageUrl  ? String(b.imageUrl)  : undefined,
      imageColor: b.imageColor ? String(b.imageColor) : undefined,
      organizer:   b.organizer   ? String(b.organizer)   : undefined,
      organizerId: req.user!.id,
      priceCents:  b.priceCents  != null ? Number(b.priceCents)  : undefined,
      priceLabel:  b.priceLabel  ? String(b.priceLabel)  : undefined,
      category:    b.category    ? String(b.category)    : undefined,
      capacity:    b.capacity    != null ? Number(b.capacity) : undefined,
      attending:   0,
      isFree:    b.isFree    != null ? Boolean(b.isFree)    : true,
      isFeatured: b.isFeatured != null ? Boolean(b.isFeatured) : false,
      tiers:     Array.isArray(b.tiers)        ? b.tiers        : undefined,
      tags:      Array.isArray(b.tags)         ? b.tags         : undefined,
      indigenousTags: Array.isArray(b.indigenousTags) ? b.indigenousTags : undefined,
      languageTags:   Array.isArray(b.languageTags)   ? b.languageTags   : undefined,
      cultureTag: Array.isArray(b.cultureTag)  ? b.cultureTag  : undefined,
      geoHash:   b.geoHash   ? String(b.geoHash)   : undefined,
      eventType: b.eventType ? String(b.eventType) : undefined,
      ageSuitability: b.ageSuitability ? String(b.ageSuitability) : undefined,
      priceTier: b.priceTier ? String(b.priceTier) : undefined,
      organizerReputationScore: b.organizerReputationScore != null ? Number(b.organizerReputationScore) : 50,
      externalTicketUrl: b.externalTicketUrl ? String(b.externalTicketUrl) : null,
      cpid: `CP-E-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      status: 'draft',
    });
    return res.status(201).json(event);
  } catch (err) {
    console.error('[POST /api/events]:', err);
    return res.status(500).json({ error: 'Failed to create event' });
  }
});

// PUT /api/events/:id
app.put('/api/events/:id', requireAuth, moderationCheck, async (req, res) => {
  try {
    const existing = await eventsService.getById(qparam(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!isOwnerOrAdmin(req.user!, existing.organizerId)) {
      return res.status(403).json({ error: 'Forbidden: you do not own this event' });
    }
    const b = req.body ?? {};
    const updated = await eventsService.update(qparam(req.params.id), {
      ...(b.title        != null && { title:       String(b.title) }),
      ...(b.description  != null && { description: String(b.description) }),
      ...(b.date         != null && { date:        String(b.date) }),
      ...(b.time         != null && { time:        String(b.time) }),
      ...(b.venue        != null && { venue:       String(b.venue) }),
      ...(b.address      != null && { address:     String(b.address) }),
      ...(b.city         != null && { city:        String(b.city) }),
      ...(b.country      != null && { country:     String(b.country) }),
      ...(b.imageUrl     != null && { imageUrl:    String(b.imageUrl) }),
      ...(b.priceCents   != null && { priceCents:  Number(b.priceCents) }),
      ...(b.priceLabel   != null && { priceLabel:  String(b.priceLabel) }),
      ...(b.capacity     != null && { capacity:    Number(b.capacity) }),
      ...(b.isFree       != null && { isFree:      Boolean(b.isFree) }),
      ...(b.isFeatured   != null && { isFeatured:  Boolean(b.isFeatured) }),
      ...(Array.isArray(b.tiers)      && { tiers:      b.tiers }),
      ...(Array.isArray(b.tags)       && { tags:       b.tags }),
      ...(Array.isArray(b.cultureTag) && { cultureTag: b.cultureTag }),
      ...(b.category     != null && { category:    String(b.category) }),
      ...(b.eventType    != null && { eventType:   String(b.eventType) }),
    });
    return res.json(updated);
  } catch (err) {
    console.error('[PUT /api/events/:id]:', err);
    return res.status(500).json({ error: 'Failed to update event' });
  }
});

// DELETE /api/events/:id (soft delete)
app.delete('/api/events/:id', requireAuth, async (req, res) => {
  try {
    const existing = await eventsService.getById(qparam(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!isOwnerOrAdmin(req.user!, existing.organizerId)) {
      return res.status(403).json({ error: 'Forbidden: you do not own this event' });
    }
    await eventsService.softDelete(qparam(req.params.id));
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/events/:id]:', err);
    return res.status(500).json({ error: 'Failed to delete event' });
  }
});

// POST /api/events/:id/publish
app.post('/api/events/:id/publish', requireAuth, requireRole('organizer', 'admin'), async (req, res) => {
  try {
    const existing = await eventsService.getById(qparam(req.params.id));
    if (!existing) return res.status(404).json({ error: 'Event not found' });
    if (!isOwnerOrAdmin(req.user!, existing.organizerId)) {
      return res.status(403).json({ error: 'Forbidden: you do not own this event' });
    }
    const published = await eventsService.publish(qparam(req.params.id));
    return res.json(published);
  } catch (err) {
    console.error('[POST /api/events/:id/publish]:', err);
    return res.status(500).json({ error: 'Failed to publish event' });
  }
});

// ---------------------------------------------------------------------------
// Locations (static country + city list for onboarding)
// ---------------------------------------------------------------------------

app.get('/api/locations', (_req, res) => {
  res.json({
    locations: [
      { country: 'Australia', countryCode: 'AU', cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide', 'Canberra', 'Hobart', 'Darwin'] },
      { country: 'New Zealand', countryCode: 'NZ', cities: ['Auckland', 'Wellington', 'Christchurch', 'Hamilton', 'Dunedin'] },
      { country: 'United Arab Emirates', countryCode: 'AE', cities: ['Dubai', 'Abu Dhabi', 'Sharjah'] },
      { country: 'United Kingdom', countryCode: 'UK', cities: ['London', 'Manchester', 'Birmingham', 'Leeds'] },
      { country: 'Canada', countryCode: 'CA', cities: ['Toronto', 'Vancouver', 'Calgary', 'Montreal'] },
    ],
    acknowledgementOfCountry: 'CulturePass acknowledges the Traditional Custodians of the lands on which events are held and recognises Aboriginal and Torres Strait Islander peoples as the First Nations of Australia. We pay our respects to Elders past, present, and emerging.',
  });
});

// ---------------------------------------------------------------------------
// Communities + Profiles
// ---------------------------------------------------------------------------

app.get('/api/communities', async (req, res) => {
  const city = qstr(req.query.city) || undefined;
  const country = qstr(req.query.country) || undefined;
  if (!hasFirestoreProject) {
    return res.json(profiles.filter((p) => p.entityType === 'community'));
  }
  try {
    const items = await profilesService.listByType('community', { city, country });
    return res.json(items.length > 0 ? items : profiles.filter((p) => p.entityType === 'community'));
  } catch {
    return res.json(profiles.filter((p) => p.entityType === 'community'));
  }
});
app.get('/api/communities/nearby', async (req, res) => {
  const city = qstr(req.query.city) || undefined;
  const country = qstr(req.query.country) || undefined;
  if (!hasFirestoreProject) {
    return res.json(profiles.filter((p) => p.entityType === 'community'));
  }
  try {
    const items = await profilesService.listByType('community', { city, country });
    return res.json(items.length > 0 ? items : profiles.filter((p) => p.entityType === 'community'));
  } catch {
    return res.json(profiles.filter((p) => p.entityType === 'community'));
  }
});
app.get('/api/communities/:id', async (req, res) => {
  if (!hasFirestoreProject) {
    const community = profiles.find((p) => p.id === qparam(req.params.id) && p.entityType === 'community');
    if (!community) return res.status(404).json({ error: 'Community not found' });
    return res.json(community);
  }
  try {
    const profile = await profilesService.getById(qparam(req.params.id));
    if (!profile || profile.entityType !== 'community') {
      return res.status(404).json({ error: 'Community not found' });
    }
    return res.json(profile);
  } catch (err) {
    console.error('[GET /api/communities/:id]:', err);
    return res.status(500).json({ error: 'Failed to fetch community' });
  }
});
app.get('/api/profiles', async (req, res) => {
  const city = qstr(req.query.city) || undefined;
  const country = qstr(req.query.country) || undefined;
  if (!hasFirestoreProject) {
    return res.json(profiles);
  }
  try {
    const items = await profilesService.list({ city, country });
    return res.json(items.length > 0 ? items : profiles);
  } catch {
    return res.json(profiles);
  }
});
app.get('/api/profiles/:id', async (req, res) => {
  if (!hasFirestoreProject) {
    const profile = profiles.find((p) => p.id === qparam(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile);
  }
  try {
    const profile = await profilesService.getById(qparam(req.params.id));
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.json(profile);
  } catch (err) {
    console.error('[GET /api/profiles/:id]:', err);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});
app.post('/api/profiles', requireAuth, moderationCheck, async (req, res) => {
  const b = req.body ?? {};
  if (!hasFirestoreProject) {
    const profile: AppProfile = {
      id: randomUUID(),
      name: String(b.name ?? 'Untitled'),
      entityType: (b.entityType ?? 'organisation') as EntityType,
      category: String(b.category ?? 'General'),
      city: String(b.city ?? 'Sydney'),
      country: String(b.country ?? 'Australia'),
      description: String(b.description ?? ''),
    };
    profiles.push(profile);
    return res.status(201).json(profile);
  }
  try {
    const profile = await profilesService.create({
      name: String(b.name ?? 'Untitled'),
      entityType: (b.entityType ?? 'organisation') as FirestoreProfile['entityType'],
      description: b.description ? String(b.description) : undefined,
      imageUrl: b.imageUrl ? String(b.imageUrl) : undefined,
      city: b.city ? String(b.city) : undefined,
      country: b.country ? String(b.country) : undefined,
      website: b.website ? String(b.website) : undefined,
      ownerId: req.user!.id,
    });
    return res.status(201).json(profile);
  } catch (err) {
    console.error('[POST /api/profiles]:', err);
    return res.status(500).json({ error: 'Failed to create profile' });
  }
});
// List businesses with optional city/country + sponsorship sort
app.get('/api/businesses', async (req, res) => {
  const city = String(req.query.city ?? '');
  const country = String(req.query.country ?? '');
  const sponsored = req.query.sponsored === 'true';

  if (hasFirestoreProject) {
    try {
      let query = db.collection('profiles').where('entityType', '==', 'business') as FirebaseFirestore.Query;
      if (city) query = query.where('city', '==', city);
      if (country) query = query.where('country', '==', country);
      const snap = await query.get();
      let items = snap.docs.map((d) => d.data());
      // Sponsored businesses float to the top
      items = items.sort((a, b) => {
        const aSponsored = a.isSponsored ? 1 : 0;
        const bSponsored = b.isSponsored ? 1 : 0;
        if (bSponsored !== aSponsored) return bSponsored - aSponsored;
        return (b.rating ?? 0) - (a.rating ?? 0);
      });
      if (sponsored) items = items.filter((x) => x.isSponsored);
      return res.json(items);
    } catch (err) {
      console.error('[GET /api/businesses]:', err);
      return res.status(500).json({ error: 'Failed to fetch businesses' });
    }
  }
  const filtered = profiles
    .filter((p) => p.entityType === 'business')
    .filter((p) => !city || p.city?.toLowerCase() === city.toLowerCase())
    .filter((p) => !country || p.country?.toLowerCase() === country.toLowerCase());
  return res.json(filtered);
});

app.get('/api/businesses/:id', async (req, res) => {
  if (!hasFirestoreProject) {
    const profile = profiles.find((p) => p.id === qparam(req.params.id) && p.entityType === 'business');
    if (!profile) return res.status(404).json({ error: 'Business not found' });
    return res.json(profile);
  }
  try {
    const profile = await profilesService.getById(qparam(req.params.id));
    if (!profile || profile.entityType !== 'business') {
      return res.status(404).json({ error: 'Business not found' });
    }
    return res.json(profile);
  } catch (err) {
    console.error('[GET /api/businesses/:id]:', err);
    return res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// ---------------------------------------------------------------------------
// Content collections (movies, restaurants, activities, shopping)
// ---------------------------------------------------------------------------

function mapCollection(prefix: string) {
  return events.map((e, i) => ({ id: `${prefix}${i + 1}`, title: e.title, name: e.title, city: e.city, country: e.country, imageUrl: e.imageUrl, category: e.communityTag, description: e.description, venue: e.venue, language: 'English', genre: [e.communityTag], posterUrl: e.imageUrl, priceRange: '$$', location: e.venue, priceLabel: '$25' }));
}
const movies = mapCollection('m');
const restaurants = mapCollection('r');
const activities = mapCollection('a');
const shopping = mapCollection('s');

for (const [collPath, data] of [
  ['/api/movies', movies],
  ['/api/restaurants', restaurants],
  ['/api/activities', activities],
  ['/api/shopping', shopping],
] as const) {
  app.get(collPath, (req, res) => {
    const country = String(req.query.country ?? '').toLowerCase();
    const city = String(req.query.city ?? '').toLowerCase();
    res.json(data.filter((x) => (!country || x.country.toLowerCase() === country) && (!city || x.city.toLowerCase() === city)));
  });
  app.get(`${collPath}/:id`, (req, res) => {
    const item = data.find((x) => x.id === qparam(req.params.id));
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(item);
  });
}

// ---------------------------------------------------------------------------
// Wallet, Transactions, Payment Methods
// ---------------------------------------------------------------------------

app.get('/api/wallet/:userId', requireAuth, (req, res) => {
  const userId = qparam(req.params.userId);
  if (!isOwnerOrAdmin(req.user!, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!hasFirestoreProject) {
    const legacyWallet = wallets.get(userId);
    if (!legacyWallet) return res.json(null);
    const balanceCents = Math.round(Number(legacyWallet.balance ?? 0));
    const currency = String(legacyWallet.currency ?? 'AUD');
    const tx = transactions.get(userId) ?? [];
    return res.json({
      id: legacyWallet.id ?? `w-${userId}`,
      userId,
      balance: Number((balanceCents / 100).toFixed(2)),
      balanceCents,
      currency,
      points: Number(legacyWallet.points ?? 0),
      rewards: buildRewardsStatus(legacyWallet.points ?? 0),
      transactions: tx.map((item) => toTransactionApiRecord(userId, currency, item)),
    });
  }
  walletsService.getOrCreate(userId)
    .then((wallet) => res.json({
      id: `w-${userId}`,
      userId,
      balance: Number((Number(wallet.balanceCents ?? 0) / 100).toFixed(2)),
      balanceCents: Number(wallet.balanceCents ?? 0),
      currency: wallet.currency ?? 'AUD',
      points: Number(wallet.points ?? 0),
      rewards: buildRewardsStatus(wallet.points ?? 0),
      transactions: (wallet.transactions ?? []).map((item) =>
        toTransactionApiRecord(userId, wallet.currency ?? 'AUD', item as RawWalletTransaction)),
    }))
    .catch((err) => {
      console.error('[GET /api/wallet/:userId]:', err);
      res.status(500).json({ error: 'Failed to fetch wallet' });
    });
});
app.get('/api/transactions/:userId', requireAuth, (req, res) => {
  const userId = qparam(req.params.userId);
  if (!isOwnerOrAdmin(req.user!, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!hasFirestoreProject) {
    const legacyWallet = wallets.get(userId);
    const currency = legacyWallet?.currency ?? 'AUD';
    return res.json((transactions.get(userId) ?? [])
      .map((item) => toTransactionApiRecord(userId, currency, item)));
  }
  walletsService.getOrCreate(userId)
    .then((wallet) => res.json((wallet.transactions ?? [])
      .map((item) => toTransactionApiRecord(userId, wallet.currency ?? 'AUD', item as RawWalletTransaction))))
    .catch((err) => {
      console.error('[GET /api/transactions/:userId]:', err);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    });
});
app.get('/api/rewards/:userId', requireAuth, async (req, res) => {
  const userId = qparam(req.params.userId);
  if (!isOwnerOrAdmin(req.user!, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    if (!hasFirestoreProject) {
      const wallet = wallets.get(userId);
      const rewards = buildRewardsStatus(wallet?.points ?? 0);
      return res.json({ userId, ...rewards });
    }
    const wallet = await walletsService.getOrCreate(userId);
    const rewards = buildRewardsStatus(wallet.points ?? 0);
    return res.json({ userId, ...rewards });
  } catch (err) {
    console.error('[GET /api/rewards/:userId]:', err);
    return res.status(500).json({ error: 'Failed to fetch rewards' });
  }
});
app.get('/api/payment-methods/:userId', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(paymentMethods.get(qparam(req.params.userId)) ?? []);
});
app.post('/api/payment-methods', requireAuth, (req, res) => {
  const userId = req.user!.id;
  const current = paymentMethods.get(userId) ?? [];
  const method = { id: randomUUID(), brand: String(req.body?.brand ?? 'visa'), last4: String(req.body?.last4 ?? '4242'), isDefault: current.length === 0 };
  paymentMethods.set(userId, [...current, method]);
  return res.status(201).json(method);
});
app.delete('/api/payment-methods/:id', requireAuth, (req, res) => {
  const uid = req.user!.id;
  const methods = paymentMethods.get(uid) ?? [];
  const next = methods.filter((method) => method.id !== qparam(req.params.id));
  if (next.length === methods.length) return res.status(404).json({ error: 'Payment method not found' });
  if (next.length > 0 && !next.some((method) => method.isDefault)) next[0].isDefault = true;
  paymentMethods.set(uid, next);
  return res.json({ ok: true });
});
app.put('/api/payment-methods/:userId/default/:methodId', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const methods = paymentMethods.get(qparam(req.params.userId)) ?? [];
  if (methods.length === 0) return res.status(404).json({ error: 'No payment methods found' });
  let found = false;
  methods.forEach((method) => { method.isDefault = method.id === qparam(req.params.methodId); if (method.isDefault) found = true; });
  if (!found) return res.status(404).json({ error: 'Payment method not found' });
  paymentMethods.set(qparam(req.params.userId), methods);
  return res.json(methods);
});
app.post('/api/wallet/:userId/topup', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const userId = qparam(req.params.userId);
  let parsedAmount = 0;
  try {
    parsedAmount = parseBody(walletTopupSchema, req.body).amount;
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid amount' });
  }

  if (hasFirestoreProject) {
    walletsService.topup(userId, Math.round(parsedAmount * 100))
      .then((wallet) => res.json({
        id: `w-${userId}`,
        userId,
        balance: Number((Number(wallet.balanceCents ?? 0) / 100).toFixed(2)),
        balanceCents: Number(wallet.balanceCents ?? 0),
        currency: wallet.currency ?? 'AUD',
        points: Number(wallet.points ?? 0),
        rewards: buildRewardsStatus(wallet.points ?? 0),
        transactions: (wallet.transactions ?? []).map((item) =>
          toTransactionApiRecord(userId, wallet.currency ?? 'AUD', item as RawWalletTransaction)),
      }))
      .catch((err) => {
        console.error('[POST /api/wallet/:userId/topup]:', err);
        res.status(500).json({ error: 'Failed to top up wallet' });
      });
    return;
  }

  const wallet = wallets.get(qparam(req.params.userId));
  if (!wallet) return res.status(404).json({ error: 'Wallet not found' });
  wallet.balance += Math.round(parsedAmount * 100);
  const tx = transactions.get(qparam(req.params.userId)) ?? [];
  tx.unshift({ id: randomUUID(), type: 'charge', amountCents: Math.round(parsedAmount * 100), createdAt: nowIso(), description: 'Wallet top up' });
  transactions.set(qparam(req.params.userId), tx);
  const balanceCents = Math.round(Number(wallet.balance ?? 0));
  return res.json({
    id: wallet.id ?? `w-${userId}`,
    userId,
    balance: Number((balanceCents / 100).toFixed(2)),
    balanceCents,
    currency: String(wallet.currency ?? 'AUD'),
    points: Number(wallet.points ?? 0),
    rewards: buildRewardsStatus(wallet.points ?? 0),
    transactions: tx.map((item) => toTransactionApiRecord(userId, String(wallet.currency ?? 'AUD'), item)),
  });
});

// ---------------------------------------------------------------------------
// Membership — Stripe Subscription + Firestore
// ---------------------------------------------------------------------------

// GET /api/membership/member-count — must be before /:userId to avoid capture
app.get('/api/membership/member-count', async (_req, res) => {
  if (!hasFirestoreProject) {
    const count = [...memberships.values()]
      .filter((m) => MEMBERSHIP_PAID_TIERS.includes(normalizeMembershipTier(m.tier)) && m.isActive)
      .length;
    return res.json({ count });
  }
  try {
    const snap = await db.collection('users')
      .where('membership.isActive', '==', true)
      .get();
    const count = snap.docs.reduce((total, doc) => {
      const tier = normalizeMembershipTier(doc.data()?.membership?.tier);
      return MEMBERSHIP_PAID_TIERS.includes(tier) ? total + 1 : total;
    }, 0);
    return res.json({ count });
  } catch {
    return res.json({ count: 0 });
  }
});

// GET /api/membership/:userId
app.get('/api/membership/:userId', requireAuth, async (req, res) => {
  const userId = qparam(req.params.userId);
  if (!isOwnerOrAdmin(req.user!, userId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (!hasFirestoreProject) {
    const membership = memberships.get(userId);
    const eventsAttended = tickets
      .filter((ticket) => ticket.userId === userId && (ticket.status === 'confirmed' || ticket.status === 'used'))
      .length;
    return res.json(buildMembershipResponse({
      tier: membership?.tier ?? 'free',
      isActive: membership?.isActive ?? false,
      expiresAt: membership?.validUntil ?? null,
      eventsAttended,
    }));
  }
  try {
    const user = await usersService.getById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const membership = user.membership ?? { tier: 'free', isActive: false };
    const userTickets = await ticketsService.listForUser(userId);
    const eventsAttended = userTickets.filter((ticket) => ticket.status === 'confirmed' || ticket.status === 'used').length;
    return res.json(buildMembershipResponse({
      tier: membership.tier,
      isActive: membership.isActive,
      expiresAt: membership.expiresAt ?? null,
      eventsAttended,
    }));
  } catch (err) {
    console.error('[GET /api/membership/:userId]:', err);
    return res.status(500).json({ error: 'Failed to fetch membership' });
  }
});

// POST /api/membership/subscribe — create Stripe subscription checkout session
app.post('/api/membership/subscribe', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  let billingPeriod: 'monthly' | 'yearly' = 'monthly';
  try {
    const payload = parseBody(membershipSubscribeSchema, req.body);
    billingPeriod = payload.billingPeriod ?? 'monthly';
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid subscription payload' });
  }

  if (!hasFirestoreProject) {
    // Dev mode: instant upgrade
    const expiresAt = new Date(Date.now() + (billingPeriod === 'yearly' ? 365 : 30) * 86_400_000).toISOString();
    const m = memberships.get(userId);
    if (m) {
      m.tier = 'plus';
      m.isActive = true;
      m.validUntil = expiresAt;
    } else {
      memberships.set(userId, { id: `m-${userId}`, userId, tier: 'plus', isActive: true, validUntil: expiresAt });
    }
    return res.json({
      checkoutUrl: null,
      tier: 'plus',
      devMode: true,
      membership: buildMembershipResponse({ tier: 'plus', isActive: true, expiresAt }),
    });
  }

  const appUrl = process.env.APP_URL ?? (process.env.FIREBASE_CONFIG
    ? `https://${JSON.parse(process.env.FIREBASE_CONFIG).projectId}.web.app`
    : 'http://localhost:5000');

  if (!stripeClient) {
    return res.status(503).json({ error: 'Stripe is not configured. Set STRIPE_SECRET_KEY.' });
  }

  const monthlyPriceId = process.env.STRIPE_PRICE_MONTHLY_ID;
  const yearlyPriceId  = process.env.STRIPE_PRICE_YEARLY_ID;
  const priceId = billingPeriod === 'yearly' ? yearlyPriceId : monthlyPriceId;
  if (!priceId) {
    return res.status(503).json({ error: `STRIPE_PRICE_${billingPeriod.toUpperCase()}_ID is not configured.` });
  }

  try {
    const user = await usersService.getById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const currentMembership = user.membership ?? { tier: 'free', isActive: false };
    const currentTier = normalizeMembershipTier(currentMembership.tier);
    if (isMembershipActive(currentTier, currentMembership.isActive, currentMembership.expiresAt ?? null)) {
      return res.json({
        checkoutUrl: null,
        alreadyActive: true,
        membership: buildMembershipResponse({
          tier: currentTier,
          isActive: currentMembership.isActive,
          expiresAt: currentMembership.expiresAt ?? null,
        }),
      });
    }

    // Look up or create Stripe Customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripeClient.customers.create({
        email: user.email,
        name: user.displayName ?? user.username,
        metadata: { firebaseUid: userId },
      });
      stripeCustomerId = customer.id;
      await usersService.upsert(userId, { stripeCustomerId });
    }

    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      metadata: { userId, billingPeriod, tier: 'plus' },
      success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${appUrl}/payment/cancel`,
    });

    return res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[POST /api/membership/subscribe]:', err);
    return res.status(500).json({ error: 'Failed to create subscription checkout session' });
  }
});

// POST /api/membership/cancel-subscription
app.post('/api/membership/cancel-subscription', requireAuth, async (req, res) => {
  const userId = req.user!.id;

  if (!hasFirestoreProject) {
    const m = memberships.get(userId);
    if (m) { m.tier = 'free'; m.isActive = false; }
    return res.json({
      success: true,
      membership: buildMembershipResponse({ tier: 'free', isActive: false, expiresAt: null }),
    });
  }

  try {
    const user = await usersService.getById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (stripeClient && user.stripeSubscriptionId) {
      await stripeClient.subscriptions.cancel(user.stripeSubscriptionId);
    }

    await usersService.upsert(userId, {
      stripeSubscriptionId: undefined,
      membership: { tier: 'free', isActive: false },
    });

    // Revoke custom claims tier
    await authAdmin.setCustomUserClaims(userId, {
      ...(await authAdmin.getUser(userId)).customClaims,
      tier: 'free',
    });

    return res.json({
      success: true,
      membership: buildMembershipResponse({ tier: 'free', isActive: false, expiresAt: null }),
    });
  } catch (err) {
    console.error('[POST /api/membership/cancel-subscription]:', err);
    return res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

// GET /api/tickets/:userId
app.get('/api/tickets/:userId', requireAuth, async (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    if (!hasFirestoreProject) {
      return res.json(tickets.filter((t) => t.userId === qparam(req.params.userId)));
    }
    const userTickets = await ticketsService.listForUser(qparam(req.params.userId));
    return res.json(userTickets);
  } catch (err) {
    console.error('[GET /api/tickets/:userId]:', err);
    if (!hasFirestoreProject) {
      return res.json(tickets.filter((t) => t.userId === qparam(req.params.userId)));
    }
    return res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /api/tickets/:userId/count
app.get('/api/tickets/:userId/count', requireAuth, async (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    if (!hasFirestoreProject) {
      const userTickets = tickets.filter((t) => t.userId === qparam(req.params.userId));
      const count = userTickets.filter((t) => t.status === 'confirmed').length;
      return res.json({ count });
    }
    const userTickets = await ticketsService.listForUser(qparam(req.params.userId));
    const count = userTickets.filter((t) => t.status === 'confirmed').length;
    return res.json({ count });
  } catch (err) {
    console.error('[GET /api/tickets/:userId/count]:', err);
    if (!hasFirestoreProject) {
      const userTickets = tickets.filter((t) => t.userId === qparam(req.params.userId));
      const count = userTickets.filter((t) => t.status === 'confirmed').length;
      return res.json({ count });
    }
    return res.status(500).json({ error: 'Failed to count tickets' });
  }
});

// GET /api/ticket/:id (singular)
app.get('/api/ticket/:id', requireAuth, async (req, res) => {
  try {
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json(ticket);
    }

    const ticket = await ticketsService.getById(qparam(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json(ticket);
  } catch (err) {
    console.error('[GET /api/ticket/:id]:', err);
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (ticket && isOwnerOrAdmin(req.user!, ticket.userId)) return res.json(ticket);
    }
    return res.status(500).json({ error: 'Failed to fetch ticket' });
  }
});

// POST /api/tickets — purchase a ticket
app.post('/api/tickets', requireAuth, async (req, res) => {
  const userId  = req.user!.id;
  const eventId = String(req.body?.eventId ?? '');
  if (!eventId) return res.status(400).json({ error: 'eventId is required' });

  try {
    const quantity = Number(req.body?.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: 'Ticket quantity must be a positive integer' });
    }

    if (!hasFirestoreProject) {
      const event = fallbackEventLookup.get(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      const priceCents = Number(req.body?.priceCents ?? event.priceCents ?? 0);
      const ticketCode = `CP-T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const ticket: AppTicket = {
        id: randomUUID(), eventId, userId,
        eventTitle: event.title, eventDate: event.date, eventTime: event.time ?? '', eventVenue: event.venue,
        tierName: String(req.body?.tierName ?? 'General'), quantity, totalPriceCents: priceCents * quantity,
        currency: 'AUD', status: 'confirmed', paymentStatus: 'paid', priority: 'normal',
        ticketCode, createdAt: nowIso(),
        history: [{ at: nowIso(), status: 'confirmed', note: 'Ticket issued (dev mode)' }],
      };
      tickets.push(ticket);
      const rewardPoints = await awardRewardsPoints(userId, ticket.totalPriceCents, {
        ticketId: ticket.id,
        source: 'ticket purchase',
      });
      if (rewardPoints > 0) {
        ticket.rewardPointsEarned = rewardPoints;
        ticket.rewardPointsAwardedAt = nowIso();
        ticket.history.push({
          at: nowIso(),
          status: 'confirmed',
          note: `Reward points awarded: +${rewardPoints}`,
        });
      }
      return res.status(201).json(ticket);
    }

    const eventRef = db.collection('events').doc(eventId);
    const ticketRef = db.collection('tickets').doc();

    const ticket = await db.runTransaction(async (transaction) => {
      const eventDoc = await transaction.get(eventRef);
      if (!eventDoc.exists) {
        throw new Error('EVENT_NOT_FOUND');
      }
      const event = eventDoc.data() as FirestoreEvent;

      if (event.capacity != null && (event.attending ?? 0) + quantity > event.capacity) {
        throw new Error('NOT_ENOUGH_CAPACITY');
      }

      const priceCents = Number(req.body?.priceCents ?? event.priceCents ?? 0);
      const qrCode = `CP-T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      const newTicketPayload = {
        id: ticketRef.id, eventId, userId,
        tierName: String(req.body?.tierName ?? 'General'),
        quantity, priceCents,
        totalPriceCents: priceCents * quantity,
        status: 'confirmed' as const,
        paymentStatus: 'paid' as const,
        qrCode, cpTicketId: qrCode,
        history: [{ action: 'ticket_created', timestamp: nowIso(), actorId: 'system' }],
        createdAt: nowIso(), updatedAt: nowIso(),
        // Denormalized fields for performance
        eventTitle: event.title,
        eventDate: event.date,
        eventVenue: event.venue,
        imageColor: event.imageColor,
      };

      transaction.set(ticketRef, newTicketPayload);
      transaction.update(eventRef, { attending: firestore.FieldValue.increment(quantity) });

      return newTicketPayload;
    });

    const explicitTotal = Number((ticket as { totalPriceCents?: number }).totalPriceCents ?? 0);
    const fallbackTotal = Number((ticket as { priceCents?: number }).priceCents ?? 0)
      * Number((ticket as { quantity?: number }).quantity ?? 1);
    const totalPriceCents = explicitTotal > 0 ? explicitTotal : fallbackTotal;
    const rewardPoints = await awardRewardsPoints(userId, totalPriceCents, {
      ticketId: String((ticket as { id?: string }).id ?? ticketRef.id),
      source: 'ticket purchase',
    });
    if (rewardPoints > 0) {
      await ticketsService.update(ticketRef.id, {
        rewardPointsEarned: rewardPoints,
        rewardPointsAwardedAt: nowIso(),
      });
    }

    return res.status(201).json(ticket);
  } catch (err) {
    console.error('[POST /api/tickets]:', err);
    if (err instanceof Error) {
      if (err.message === 'EVENT_NOT_FOUND') {
        return res.status(404).json({ error: 'Event not found' });
      }
      if (err.message === 'NOT_ENOUGH_CAPACITY') {
        return res.status(400).json({ error: 'Not enough tickets available for this quantity' });
      }
    }
    if (!hasFirestoreProject) {
      return res.status(500).json({ error: 'Failed to purchase ticket (dev mode)' });
    }
    return res.status(500).json({ error: 'Failed to purchase ticket' });
  }
});

// PUT /api/tickets/:id/cancel
app.put('/api/tickets/:id/cancel', requireAuth, async (req, res) => {
  try {
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (ticket.status === 'used') {
        return res.status(400).json({ error: 'Used tickets cannot be cancelled' });
      }
      ticket.status = 'cancelled';
      ticket.history?.push({ at: nowIso(), status: 'cancelled', note: 'Cancelled (dev mode)' });
      return res.json(ticket);
    }

    const ticket = await ticketsService.getById(qparam(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (ticket.status === 'used') {
      return res.status(400).json({ error: 'Used tickets cannot be cancelled' });
    }
    const updated = await ticketsService.updateStatus(qparam(req.params.id), 'cancelled', req.user!.id);
    return res.json(updated);
  } catch (err) {
    console.error('[PUT /api/tickets/:id/cancel]:', err);
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (ticket) return res.json(ticket);
    }
    return res.status(500).json({ error: 'Failed to cancel ticket' });
  }
});

// POST /api/tickets/scan — staff QR scan
app.post('/api/tickets/scan', requireAuth, requireRole('organizer', 'moderator', 'admin'), async (req, res) => {
  const qrCode = String(req.body?.ticketCode ?? '').trim();
  if (!qrCode) return res.status(400).json({ valid: false, error: 'ticketCode is required' });

  try {
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.ticketCode === qrCode || t.ticketCode === qrCode);
      if (!ticket) return res.status(404).json({ valid: false, error: 'Invalid ticket code' });
      if (ticket.status !== 'confirmed') {
        return res.status(400).json({ valid: false, error: `Ticket is ${ticket.status}`, ticket });
      }
      ticket.status = 'used';
      ticket.history?.push({ at: nowIso(), status: 'used', note: `Scanned by ${req.user?.id ?? 'scanner'}` });
      return res.json({ valid: true, message: 'Ticket scanned successfully', ticket });
    }

    const ticket = await ticketsService.getByQrCode(qrCode);
    if (!ticket) {
      return res.status(404).json({ valid: false, error: 'Invalid ticket code' });
    }
    if (ticket.status !== 'confirmed') {
      return res.status(400).json({
        valid: false,
        error: `Ticket is ${ticket.status}`,
        ticket,
      });
    }
    const updated = await ticketsService.updateStatus(ticket.id, 'used', req.user!.id);
    return res.json({ valid: true, message: 'Ticket scanned successfully', ticket: updated });
  } catch (err) {
    console.error('[POST /api/tickets/scan]:', err);
    if (!hasFirestoreProject) {
      return res.status(500).json({ valid: false, error: 'Scan failed (dev mode)' });
    }
    return res.status(500).json({ valid: false, error: 'Scan failed' });
  }
});

// GET /api/tickets/:id/history
app.get('/api/tickets/:id/history', requireAuth, async (req, res) => {
  try {
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
      if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      return res.json({ history: ticket.history });
    }

    const ticket = await ticketsService.getById(qparam(req.params.id));
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwnerOrAdmin(req.user!, ticket.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.json({ history: ticket.history });
  } catch (err) {
    console.error('[GET /api/tickets/:id/history]:', err);
    if (!hasFirestoreProject) {
      const ticket = tickets.find((t) => t.id === qparam(req.params.id));
      if (ticket && isOwnerOrAdmin(req.user!, ticket.userId)) return res.json({ history: ticket.history });
    }
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
});
app.get('/api/tickets/admin/scan-events', requireAuth, requireRole('moderator', 'admin'), (_req, res) => res.json(scanEvents.slice(0, 200)));
app.get('/api/tickets/:id/wallet/apple', (req, res) => {
  const ticket = tickets.find((t) => t.id === qparam(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const url = `https://wallet.culturepass.au/apple/${ticket.id}`;
  ticket.walletPasses = { ...(ticket.walletPasses ?? {}), apple: url };
  ticket.staffAuditTrail?.unshift({ at: nowIso(), by: 'user', action: 'apple_wallet_pass_generated' });
  res.json({ url, provider: 'apple', ticketId: ticket.id });
});
app.get('/api/tickets/:id/wallet/google', (req, res) => {
  const ticket = tickets.find((t) => t.id === qparam(req.params.id));
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  const url = `https://wallet.culturepass.au/google/${ticket.id}`;
  ticket.walletPasses = { ...(ticket.walletPasses ?? {}), google: url };
  ticket.staffAuditTrail?.unshift({ at: nowIso(), by: 'user', action: 'google_wallet_pass_generated' });
  res.json({ url, provider: 'google', ticketId: ticket.id });
});

// ---------------------------------------------------------------------------
// Perks + Redemptions
// ---------------------------------------------------------------------------

app.get('/api/perks', async (_req, res) => {
  if (!hasFirestoreProject) return res.json(perks);
  try {
    const items = await perksService.list();
    return res.json(items);
  } catch (err) {
    console.error('[GET /api/perks]:', err);
    return res.status(500).json({ error: 'Failed to fetch perks' });
  }
});
app.get('/api/perks/:id', async (req, res) => {
  if (!hasFirestoreProject) {
    const perk = perks.find((item) => item.id === qparam(req.params.id));
    if (!perk) return res.status(404).json({ error: 'Perk not found' });
    return res.json(perk);
  }
  try {
    const perk = await perksService.getById(qparam(req.params.id));
    if (!perk) return res.status(404).json({ error: 'Perk not found' });
    return res.json(perk);
  } catch (err) {
    console.error('[GET /api/perks/:id]:', err);
    return res.status(500).json({ error: 'Failed to fetch perk' });
  }
});
app.post('/api/perks', requireAuth, requireRole('admin'), moderationCheck, async (req, res) => {
  let payload: z.infer<typeof createPerkSchema>;
  try {
    payload = parseBody(createPerkSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid perk payload' });
  }

  if (hasFirestoreProject) {
    try {
      const perk = await perksService.create({
        title: payload.title,
        description: payload.description ?? '',
        perkType: payload.perkType,
        discountPercent: payload.discountPercent ?? null,
        discountFixedCents: payload.discountFixedCents ?? null,
        providerType: payload.providerType ?? 'business',
        providerId: payload.providerId ?? '',
        providerName: payload.providerName ?? '',
        category: payload.category,
        isMembershipRequired: Boolean(payload.isMembershipRequired ?? false),
        requiredMembershipTier: payload.requiredMembershipTier ?? 'free',
        usageLimit: payload.usageLimit ?? null,
        usedCount: 0,
        perUserLimit: payload.perUserLimit ?? null,
        status: 'active',
        startDate: nowIso(),
        endDate: payload.endDate ?? null,
      });
      return res.status(201).json(perk);
    } catch (err) {
      console.error('[POST /api/perks]:', err);
      return res.status(500).json({ error: 'Failed to create perk' });
    }
  }

  const perk = {
    id: randomUUID(), title: payload.title, description: String(payload.description ?? ''),
    perkType: payload.perkType, discountPercent: payload.discountPercent ?? null,
    discountFixedCents: payload.discountFixedCents ?? null,
    providerType: String(payload.providerType ?? 'business'), providerId: String(payload.providerId ?? ''),
    providerName: String(payload.providerName ?? ''), category: payload.category,
    isMembershipRequired: Boolean(payload.isMembershipRequired ?? false),
    requiredMembershipTier: String(payload.requiredMembershipTier ?? 'free'),
    usageLimit: payload.usageLimit ?? null, usedCount: 0,
    perUserLimit: payload.perUserLimit ?? null,
    status: 'active', startDate: nowIso(), endDate: payload.endDate ?? null,
  };
  perks.unshift(perk);
  return res.status(201).json(perk);
});
app.post('/api/perks/:id/redeem', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const perkId = qparam(req.params.id);

  if (hasFirestoreProject) {
    try {
      const perk = await perksService.getById(perkId);
      if (!perk) return res.status(404).json({ error: 'Perk not found' });
      const alreadyUsed = await redemptionsService.countForUserAndPerk(userId, perkId);
      if (perk.perUserLimit && alreadyUsed >= perk.perUserLimit) {
        return res.status(400).json({ error: 'Per-user redemption limit reached' });
      }
      if (perk.isMembershipRequired) {
        const membership = await usersService.getById(userId);
        const tier = membership?.membership?.tier ?? 'free';
        if (tier === 'free') return res.status(403).json({ error: 'Membership tier required for this perk' });
      }
      const redemption = await redemptionsService.create({ perkId, userId, redeemedAt: nowIso() });
      await perksService.incrementUsed(perkId);
      return res.status(201).json(redemption);
    } catch (err) {
      console.error('[POST /api/perks/:id/redeem]:', err);
      return res.status(500).json({ error: 'Failed to redeem perk' });
    }
  }

  const perk = perks.find((item) => item.id === perkId);
  if (!perk) return res.status(404).json({ error: 'Perk not found' });
  const userRedemptions = redemptions.get(userId) ?? [];
  const alreadyUsed = userRedemptions.filter((item) => item.perkId === perkId).length;
  if (perk.perUserLimit && alreadyUsed >= perk.perUserLimit) return res.status(400).json({ error: 'Per-user redemption limit reached' });
  if (perk.isMembershipRequired) {
    const membership = memberships.get(userId);
    if (!membership || membership.tier === 'free') return res.status(403).json({ error: 'Membership tier required for this perk' });
  }
  const redemption = { id: randomUUID(), perkId, userId, redeemedAt: nowIso() };
  userRedemptions.unshift(redemption);
  redemptions.set(userId, userRedemptions);
  perk.usedCount = Number(perk.usedCount ?? 0) + 1;
  return res.status(201).json(redemption);
});
app.get('/api/redemptions', requireAuth, async (req, res) => {
  const userId = req.user!.id;
  if (hasFirestoreProject) {
    try {
      const items = await redemptionsService.listForUser(userId);
      return res.json(items);
    } catch (err) {
      console.error('[GET /api/redemptions]:', err);
      return res.status(500).json({ error: 'Failed to fetch redemptions' });
    }
  }
  return res.json(redemptions.get(userId) ?? []);
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

app.get('/api/notifications/:userId', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (hasFirestoreProject) {
    notificationsService.listForUser(qparam(req.params.userId))
      .then((items) => res.json(items))
      .catch((err) => {
        console.error('[GET /api/notifications/:userId]:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
      });
    return;
  }
  return res.json(notifications.get(qparam(req.params.userId)) ?? []);
});
app.get('/api/notifications/:userId/unread-count', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (hasFirestoreProject) {
    notificationsService.unreadCount(qparam(req.params.userId))
      .then((count) => res.json({ count }))
      .catch((err) => {
        console.error('[GET /api/notifications/:userId/unread-count]:', err);
        res.status(500).json({ error: 'Failed to fetch notification count' });
      });
    return;
  }
  const list = notifications.get(qparam(req.params.userId)) ?? [];
  return res.json({ count: list.filter((n) => !n.isRead).length });
});
app.put('/api/notifications/:id/read', requireAuth, async (req, res) => {
  if (hasFirestoreProject) {
    const item = await notificationsService.getById(qparam(req.params.id));
    if (!item) return res.status(404).json({ error: 'Notification not found' });
    if (!isOwnerOrAdmin(req.user!, item.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await notificationsService.markRead(item.id);
    return res.json({ ok: true, item: { ...item, isRead: true } });
  }

  const uid = req.user!.id;
  const list = notifications.get(uid) ?? [];
  const item = list.find((n) => n.id === qparam(req.params.id));
  if (!item) return res.status(404).json({ error: 'Notification not found' });
  item.isRead = true;
  notifications.set(uid, list);
  return res.json({ ok: true, item });
});
app.put('/api/notifications/:userId/read-all', requireAuth, async (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (hasFirestoreProject) {
    await notificationsService.markAllRead(qparam(req.params.userId));
    const count = await notificationsService.unreadCount(qparam(req.params.userId));
    return res.json({ ok: true, unreadCount: count });
  }
  const list = notifications.get(qparam(req.params.userId)) ?? [];
  list.forEach((item) => { item.isRead = true; });
  notifications.set(qparam(req.params.userId), list);
  return res.json({ ok: true, updated: list.length });
});
app.delete('/api/notifications/:id', requireAuth, async (req, res) => {
  if (hasFirestoreProject) {
    const item = await notificationsService.getById(qparam(req.params.id));
    if (!item) return res.status(404).json({ error: 'Notification not found' });
    if (!isOwnerOrAdmin(req.user!, item.userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await notificationsService.delete(item.id);
    return res.json({ ok: true });
  }

  const uid = req.user!.id;
  const list = notifications.get(uid) ?? [];
  const next = list.filter((item) => item.id !== qparam(req.params.id));
  if (next.length === list.length) return res.status(404).json({ error: 'Notification not found' });
  notifications.set(uid, next);
  return res.json({ ok: true });
});
app.post('/api/notifications/:userId/:id/read', requireAuth, async (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  if (hasFirestoreProject) {
    const item = await notificationsService.getById(qparam(req.params.id));
    if (!item || item.userId !== qparam(req.params.userId)) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    await notificationsService.markRead(item.id);
    return res.json({ ok: true });
  }
  const list = notifications.get(qparam(req.params.userId)) ?? [];
  list.forEach((n) => { if (n.id === qparam(req.params.id)) n.isRead = true; });
  return res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

app.get('/api/reviews/:profileId', (req, res) => res.json([
  { id: randomUUID(), profileId: req.params.profileId, userId: users[0].id, rating: 5, comment: 'Great community!', createdAt: nowIso() },
]));

// ---------------------------------------------------------------------------
// Image Upload → Firebase Storage
// ---------------------------------------------------------------------------

app.post('/api/uploads/image', upload.single('image'), async (req, res) => {
  try {
    if (!storageBucket) {
      return res.status(503).json({ error: 'Firebase Storage bucket is not configured' });
    }

    const file = req.file;
    if (!file) return res.status(400).json({ error: 'image file is required' });
    if (!file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Only image uploads are allowed' });

    const metadata = await sharp(file.buffer).metadata();
    if (!metadata.width || !metadata.height) return res.status(400).json({ error: 'Invalid image metadata' });

    const id = randomUUID();

    const imageBuffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 86 })
      .toBuffer();

    const thumbBuffer = await sharp(file.buffer)
      .rotate()
      .resize({ width: 420, height: 420, fit: 'cover', withoutEnlargement: false })
      .webp({ quality: 88 })
      .toBuffer();

    const imageFile = storageBucket.file(`images/${id}.jpg`);
    const thumbFile = storageBucket.file(`thumbnails/${id}.webp`);

    await Promise.all([
      imageFile.save(imageBuffer, { metadata: { contentType: 'image/jpeg' }, resumable: false }),
      thumbFile.save(thumbBuffer, { metadata: { contentType: 'image/webp' }, resumable: false }),
    ]);

    const [imageUrl] = await imageFile.getSignedUrl({ action: 'read', expires: '2099-01-01' });
    const [thumbnailUrl] = await thumbFile.getSignedUrl({ action: 'read', expires: '2099-01-01' });

    return res.status(201).json({ id, imageUrl, thumbnailUrl, width: metadata.width, height: metadata.height, mimeType: file.mimetype, size: file.size });
  } catch (error) {
    return res.status(500).json({ error: 'Image upload failed', details: String(error) });
  }
});

app.post('/api/media/attach', requireAuth, async (req, res) => {
  let payload: z.infer<typeof mediaAttachSchema>;
  try {
    payload = parseBody(mediaAttachSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid media payload' });
  }

  if (hasFirestoreProject) {
    try {
      const media = await mediaService.attach({
        targetType: payload.targetType,
        targetId: payload.targetId,
        imageUrl: payload.imageUrl,
        thumbnailUrl: payload.thumbnailUrl,
        width: payload.width ?? 0,
        height: payload.height ?? 0,
        uploadedBy: req.user!.id,
        createdAt: nowIso(),
      });
      return res.status(201).json(media);
    } catch (err) {
      console.error('[POST /api/media/attach]:', err);
      return res.status(500).json({ error: 'Failed to attach media' });
    }
  }

  const media: UploadedMedia = {
    id: randomUUID(),
    targetType: payload.targetType,
    targetId: payload.targetId,
    imageUrl: payload.imageUrl,
    thumbnailUrl: payload.thumbnailUrl,
    width: payload.width ?? 0,
    height: payload.height ?? 0,
    createdAt: nowIso(),
  };
  uploadedMedia.unshift(media);
  if (payload.targetType === 'user') { const user = users.find((item) => item.id === payload.targetId); if (user) user.avatarUrl = payload.imageUrl; }
  if (payload.targetType === 'profile' || payload.targetType === 'business') { const profile = profiles.find((item) => item.id === payload.targetId); if (profile) profile.imageUrl = payload.imageUrl; }
  if (payload.targetType === 'event') { const event = events.find((item) => item.id === payload.targetId); if (event) event.imageUrl = payload.imageUrl; }
  return res.status(201).json(media);
});
app.get('/api/media/:targetType/:targetId', async (req, res) => {
  if (hasFirestoreProject) {
    try {
      const items = await mediaService.listForTarget(req.params.targetType, req.params.targetId);
      return res.json(items);
    } catch (err) {
      console.error('[GET /api/media/:targetType/:targetId]:', err);
      return res.status(500).json({ error: 'Failed to fetch media' });
    }
  }
  const items = uploadedMedia.filter((item) => item.targetType === req.params.targetType && item.targetId === req.params.targetId);
  return res.json(items);
});

// ---------------------------------------------------------------------------
// Reports + Admin
// ---------------------------------------------------------------------------

app.post('/api/reports', requireAuth, moderationCheck, async (req, res) => {
  let payload: z.infer<typeof reportCreateSchema>;
  try {
    payload = parseBody(reportCreateSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid report payload' });
  }

  if (hasFirestoreProject) {
    try {
      const report = await reportsService.create({
        targetType: payload.targetType,
        targetId: payload.targetId,
        reason: payload.reason,
        details: payload.details,
        reporterUserId: req.user!.id,
        status: 'pending',
        createdAt: nowIso(),
      });
      return res.status(201).json(report);
    } catch (err) {
      console.error('[POST /api/reports]:', err);
      return res.status(500).json({ error: 'Failed to submit report' });
    }
  }

  const report: ContentReport = {
    id: randomUUID(),
    targetType: payload.targetType,
    targetId: payload.targetId,
    reason: payload.reason,
    details: payload.details,
    reporterUserId: req.user!.id,
    status: 'pending',
    createdAt: nowIso(),
  };
  reports.unshift(report);
  return res.status(201).json(report);
});
app.get('/api/admin/reports', requireAuth, requireRole('admin'), async (_req, res) => {
  if (hasFirestoreProject) {
    try {
      const items = await reportsService.list();
      const grouped = {
        pending: items.filter((item) => item.status === 'pending').length,
        reviewing: items.filter((item) => item.status === 'reviewing').length,
        resolved: items.filter((item) => item.status === 'resolved').length,
        dismissed: items.filter((item) => item.status === 'dismissed').length,
      };
      return res.json({ summary: grouped, reports: items });
    } catch (err) {
      console.error('[GET /api/admin/reports]:', err);
      return res.status(500).json({ error: 'Failed to fetch reports' });
    }
  }

  const grouped = { pending: reports.filter((item) => item.status === 'pending').length, reviewing: reports.filter((item) => item.status === 'reviewing').length, resolved: reports.filter((item) => item.status === 'resolved').length, dismissed: reports.filter((item) => item.status === 'dismissed').length };
  return res.json({ summary: grouped, reports });
});
app.put('/api/admin/reports/:id/review', requireAuth, requireRole('admin'), async (req, res) => {
  const parsed = reportReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid review payload' });
  }

  const status = parsed.data.status ?? 'reviewing';

  if (hasFirestoreProject) {
    try {
      const updated = await reportsService.review(
        qparam(req.params.id),
        status,
        req.user!.id,
        parsed.data.moderationNotes
      );
      if (!updated) return res.status(404).json({ error: 'Report not found' });
      return res.json(updated);
    } catch (err) {
      console.error('[PUT /api/admin/reports/:id/review]:', err);
      return res.status(500).json({ error: 'Failed to review report' });
    }
  }

  const report = reports.find((item) => item.id === qparam(req.params.id));
  if (!report) return res.status(404).json({ error: 'Report not found' });
  if (!['pending', 'reviewing', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ error: 'Invalid report status' });
  report.status = status as ReportStatus; report.reviewedAt = nowIso(); report.reviewedBy = req.user!.id; report.moderationNotes = parsed.data.moderationNotes?.trim() || undefined;
  return res.json(report);
});

// ---------------------------------------------------------------------------
// Admin — user management (role assignment)
// ---------------------------------------------------------------------------

const VALID_ROLES = ['user', 'organizer', 'business', 'sponsor', 'cityAdmin', 'moderator', 'admin', 'platformAdmin'] as const;
type ValidRole = typeof VALID_ROLES[number];

app.get('/api/admin/users', requireAuth, requireRole('admin', 'platformAdmin'), async (req, res) => {
  const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
  const page = Math.max(Number(req.query['page'] ?? 0), 0);
  try {
    const snap = await db.collection('users')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .offset(page * limit)
      .get();
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return res.json({ users, total: snap.size, page, limit });
  } catch (err) {
    console.error('[GET /api/admin/users]:', err);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.put('/api/admin/users/:id/role', requireAuth, requireRole('admin', 'platformAdmin'), async (req, res) => {
  const targetId = qparam(req.params.id);
  const { role } = req.body as { role: ValidRole };
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role', validRoles: VALID_ROLES });
  }
  try {
    const existing = await authAdmin.getUser(targetId);
    await authAdmin.setCustomUserClaims(targetId, { ...(existing.customClaims ?? {}), role });
    await db.collection('users').doc(targetId).set({ role }, { merge: true });
    return res.json({ success: true, id: targetId, role });
  } catch (err) {
    console.error('[PUT /api/admin/users/:id/role]:', err);
    return res.status(500).json({ error: 'Failed to assign role' });
  }
});

// ---------------------------------------------------------------------------
// Privacy
// ---------------------------------------------------------------------------

app.get('/api/privacy/settings/:userId', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  return res.json(privacySettings.get(qparam(req.params.userId)) ?? { profileVisible: true, searchable: true });
});
app.put('/api/privacy/settings/:userId', requireAuth, (req, res) => {
  if (!isOwnerOrAdmin(req.user!, qparam(req.params.userId))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const merged = { ...(privacySettings.get(qparam(req.params.userId)) ?? {}), ...(req.body ?? {}) };
  privacySettings.set(qparam(req.params.userId), merged);
  return res.json(merged);
});

// ---------------------------------------------------------------------------
// CPID Lookup
// ---------------------------------------------------------------------------

app.get('/api/cpid/lookup/:cpid', (req, res) => {
  const normalized = req.params.cpid.toUpperCase();
  const user = users.find((u) => u.culturePassId === normalized);
  if (!user) return res.status(404).json({ error: 'CPID not found' });
  res.json({ entityType: 'user', targetId: user.id });
});

// ---------------------------------------------------------------------------
// Indigenous + Discovery
// ---------------------------------------------------------------------------

app.get('/api/indigenous/traditional-lands', async (req, res) => {
  if (hasFirestoreProject) {
    try {
      const city = String(req.query.city ?? '').toLowerCase();
      let query = db.collection('traditionalLands') as FirebaseFirestore.Query;
      if (city) query = query.where('city', '==', city.charAt(0).toUpperCase() + city.slice(1));
      const snap = await query.get();
      return res.json(snap.docs.map((d) => d.data()));
    } catch (err) {
      console.error('[GET /api/indigenous/traditional-lands]:', err);
      return res.status(500).json({ error: 'Failed to fetch traditional lands' });
    }
  }
  // Dev fallback — 7 major cities
  return res.json([
    { id: 'tl-gadigal', city: 'Sydney', country: 'Australia', landName: 'Gadigal Land', traditionalCustodians: 'Gadigal People of the Eora Nation', acknowledgement: 'CulturePass acknowledges the Gadigal people of the Eora Nation as the traditional custodians of this land.', language: 'Dharug' },
    { id: 'tl-wurundjeri', city: 'Melbourne', country: 'Australia', landName: 'Wurundjeri Country', traditionalCustodians: 'Wurundjeri People of the Kulin Nation', acknowledgement: 'We acknowledge the Wurundjeri people of the Kulin Nation as the traditional custodians of Melbourne.', language: 'Woi wurrung' },
    { id: 'tl-turrbal', city: 'Brisbane', country: 'Australia', landName: 'Turrbal and Yugara Country', traditionalCustodians: 'Turrbal and Yugara People', acknowledgement: 'We acknowledge the Turrbal and Yugara peoples as the traditional custodians of Brisbane.', language: 'Yugarapul' },
    { id: 'tl-kaurna', city: 'Adelaide', country: 'Australia', landName: 'Kaurna Country', traditionalCustodians: 'Kaurna People', acknowledgement: 'CulturePass acknowledges the Kaurna people as the traditional custodians of the Adelaide Plains.', language: 'Kaurna' },
    { id: 'tl-whadjuk', city: 'Perth', country: 'Australia', landName: 'Whadjuk Noongar Country', traditionalCustodians: 'Whadjuk People of the Noongar Nation', acknowledgement: 'We acknowledge the Whadjuk people of the Noongar Nation as the traditional custodians of Perth.', language: 'Noongar' },
    { id: 'tl-ngati-whatua', city: 'Auckland', country: 'New Zealand', landName: "Ngāti Whātua Ōrākei Ancestral Land", traditionalCustodians: "Ngāti Whātua Ōrākei", acknowledgement: "We acknowledge Ngāti Whātua Ōrākei as the tangata whenua of Auckland, Tāmaki Makaurau.", language: "Te Reo Māori" },
  ]);
});

app.get('/api/indigenous/spotlights', async (_req, res) => {
  if (hasFirestoreProject) {
    try {
      const snap = await db.collection('indigenousSpotlights').orderBy('createdAt', 'desc').limit(10).get();
      return res.json(snap.docs.map((d) => d.data()));
    } catch (err) {
      console.error('[GET /api/indigenous/spotlights]:', err);
      return res.status(500).json({ error: 'Failed to fetch spotlights' });
    }
  }
  // Dev fallback
  return res.json([
    { id: 'spot-1', title: 'Songlines: Tracking the Seven Sisters', description: 'A landmark exhibition celebrating the Martu Seven Sisters Dreaming — one of the most significant First Nations stories in the world.', imageUrl: 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=800', type: 'exhibition', city: 'Canberra', country: 'Australia' },
    { id: 'spot-2', title: 'Bangarra Dance Theatre — BASIC', description: 'Award-winning First Nations dance company returns with a powerful new production.', imageUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=800', type: 'performance', city: 'Sydney', country: 'Australia' },
    { id: 'spot-3', title: 'NAIDOC Week — Our Community, Our Future', description: 'NAIDOC Week 2026 celebrates First Nations peoples across every major Australian city.', imageUrl: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800', type: 'event', city: 'National', country: 'Australia' },
    { id: 'spot-4', title: "Matariki — Māori New Year", description: "Te Papa Tongarewa's annual Matariki exhibition celebrating the Māori New Year. Free entry.", imageUrl: 'https://images.unsplash.com/photo-1494500764479-0c8f2919a3d8?w=800', type: 'exhibition', city: 'Auckland', country: 'New Zealand' },
  ]);
});
app.get('/api/discover/trending', (req, res) => {
  const userId = String(req.query.userId ?? '');
  const profile = userId ? recommendationProfiles.get(userId) : null;
  const tagWeights = profile?.culturalTagWeights ?? {};
  const active = events.filter((e) => !e.deletedAt);
  const sorted = active.map((e) => {
    const tags = [...(e.cultureTag ?? []), e.communityTag].map((t) => t?.toLowerCase()).filter(Boolean);
    const tagBoost = tags.some((t) => t && tagWeights[t] != null) ? 10 : 0;
    return { event: e, score: (e.organizerReputationScore ?? 50) + tagBoost };
  }).sort((a, b) => b.score - a.score).slice(0, 10).map((s) => s.event);
  res.json(sorted);
});
app.get('/api/discover/:userId', async (req, res) => {
  const userId = qparam(req.params.userId);
  const cityParam  = qparam(String(req.query.city  ?? ''));
  const countryParam = qparam(String(req.query.country ?? ''));

  // 1 — resolve user location: query param > Firestore user doc > fallback
  let city = cityParam;
  let country = countryParam;
  if (hasFirestoreProject && (!city || !country)) {
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      if (userDoc.exists) {
        const data = userDoc.data() ?? {};
        city    = city    || String(data.city    ?? '');
        country = country || String(data.country ?? '');
      }
    } catch { /* continue with empty city */ }
  }

  // 2 — recommendation profile weights
  const recProfile = recommendationProfiles.get(userId);
  const tagWeights  = recProfile?.culturalTagWeights ?? {};
  const typeWeights = recProfile?.eventTypeWeights  ?? {};

  // 3 — fetch candidate events from Firestore (filtered by location when available)
  let candidateEvents: AppEvent[] = [];
  if (hasFirestoreProject) {
    try {
      let q = db.collection('events').where('status', '==', 'published') as FirebaseFirestore.Query;
      if (city)    q = q.where('city',    '==', city);
      if (country && !city) q = q.where('country', '==', country);
      const snap = await q.limit(100).get();
      candidateEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppEvent));
    } catch {
      candidateEvents = events.filter((e) => !e.deletedAt);
    }
  } else {
    candidateEvents = events.filter((e) => !e.deletedAt && (!city || e.city === city) && (!country || e.country === country));
  }

  // 4 — score events
  const now = Date.now();
  const scored = candidateEvents.map((event) => {
    let score = 0;
    const reasons: string[] = [];

    // Cultural tag affinity
    const eventTags = [...(event.cultureTag ?? []), event.communityTag].map((t) => t?.toLowerCase()).filter(Boolean);
    let tagScore = 0;
    for (const tag of eventTags) {
      if (tag && tagWeights[tag] != null) tagScore = Math.max(tagScore, tagWeights[tag]);
      else if (tag) tagScore = Math.max(tagScore, 0.3);
    }
    if (tagScore > 0) { score += tagScore * 0.40; reasons.push('Matches your cultural interests'); }

    // Event type affinity
    if (event.eventType && typeWeights[event.eventType] != null) { score += typeWeights[event.eventType] * 0.10; reasons.push('Matches your preferred event type'); }

    // Organiser reputation
    const repScore = (event.organizerReputationScore ?? 50) / 100;
    score += repScore * 0.05;
    if (repScore > 0.8) reasons.push('Highly rated organiser');

    // Featured boost
    if (event.isFeatured) { score += 0.15; reasons.push('Featured event'); }

    // Recency boost — upcoming events within 30 days get a boost
    const eventDate = event.date ? new Date(event.date).getTime() : 0;
    const daysUntil = (eventDate - now) / 86400000;
    if (daysUntil >= 0 && daysUntil <= 30) { score += 0.10; reasons.push('Coming up soon'); }

    // Location match boost
    if (city && event.city === city) { score += 0.10; reasons.push(`In ${city}`); }

    score += 0.05; // baseline
    return { event, matchScore: Math.round(score * 100) / 100, matchReason: reasons.length > 0 ? reasons : ['Trending near you'] };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  // 5 — fetch nearby communities
  let nearbyCommunities: AppProfile[] = [];
  if (hasFirestoreProject) {
    try {
      let cq = db.collection('profiles').where('entityType', '==', 'community') as FirebaseFirestore.Query;
      if (city) cq = cq.where('city', '==', city);
      const csnap = await cq.limit(10).get();
      nearbyCommunities = csnap.docs.map((d) => ({ id: d.id, ...d.data() } as AppProfile));
    } catch {
      nearbyCommunities = profiles.filter((p) => p.entityType === 'community');
    }
  } else {
    nearbyCommunities = profiles.filter((p) => p.entityType === 'community' && (!city || (p as Record<string, unknown>)['city'] === city));
  }

  res.json({
    trendingEvents: scored.slice(0, 10).map((s) => s.event),
    rankedEvents:   scored.slice(0, 20),
    suggestedCommunities: nearbyCommunities,
    meta: { userId, city, country, generatedAt: new Date().toISOString(), totalItems: scored.length },
  });
});
app.post('/api/discover/feedback', (req, res) => {
  const { userId, eventId, signal } = req.body ?? {};
  if (!userId || !eventId || !['up', 'down'].includes(signal)) return res.status(400).json({ error: 'userId, eventId, and signal (up|down) are required' });
  const idx = discoveryFeedbackStore.findIndex((f) => f.userId === userId && f.eventId === eventId);
  if (idx !== -1) discoveryFeedbackStore.splice(idx, 1);
  discoveryFeedbackStore.push({ userId, eventId, signal, createdAt: nowIso() });
  const event = events.find((e) => e.id === eventId);
  if (event) {
    const current = recommendationProfiles.get(userId) ?? { culturalTagWeights: {}, eventTypeWeights: {} };
    const delta = signal === 'up' ? 0.1 : -0.05;
    const newTagWeights = { ...current.culturalTagWeights };
    const newTypeWeights = { ...current.eventTypeWeights };
    for (const tag of [...(event.cultureTag ?? []), event.communityTag]) {
      if (tag) { const key = tag.toLowerCase(); newTagWeights[key] = Math.max(0, Math.min(1, (newTagWeights[key] ?? 0.5) + delta)); }
    }
    if (event.eventType) { const key = event.eventType.toLowerCase(); newTypeWeights[key] = Math.max(0, Math.min(1, (newTypeWeights[key] ?? 0.5) + delta)); }
    recommendationProfiles.set(userId, { culturalTagWeights: newTagWeights, eventTypeWeights: newTypeWeights });
  }
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Cultural Tags + Intelligence
// ---------------------------------------------------------------------------

app.get('/api/cultural-tags', (_req, res) => res.json(culturalTagStore));
app.get('/api/cultural-tags/:slug/events', (req, res) => {
  const slug = req.params.slug.toLowerCase();
  const matched = events.filter((e) => { if (e.deletedAt) return false; const tags = [...(e.cultureTag ?? []), e.communityTag].map((t) => t?.toLowerCase()).filter(Boolean); return tags.some((t) => t === slug || t?.replace(/\s+/g, '-') === slug); });
  res.json(matched);
});
app.post('/api/cultural-tags', requireAuth, requireRole('admin'), (req, res) => {
  const { name, slug, category, iconUrl } = req.body ?? {};
  if (!name || !slug) return res.status(400).json({ error: 'name and slug are required' });
  if (culturalTagStore.find((t) => t.slug === slug)) return res.status(409).json({ error: 'Tag with this slug already exists' });
  const tag = { id: randomUUID(), name: String(name), slug: String(slug), category: String(category ?? 'diaspora'), iconUrl: iconUrl ? String(iconUrl) : undefined };
  culturalTagStore.push(tag);
  res.status(201).json(tag);
});
app.get('/api/cultural-intelligence/:userId', (req, res) => {
  const userId = qparam(req.params.userId);
  const profile = recommendationProfiles.get(userId) ?? { culturalTagWeights: {}, eventTypeWeights: {} };
  const topTags = Object.entries(profile.culturalTagWeights).sort(([, a], [, b]) => b - a).slice(0, 5).map(([tag, weight]) => ({ tag, affinity: Math.round(weight * 100) }));
  const topEventTypes = Object.entries(profile.eventTypeWeights).sort(([, a], [, b]) => b - a).slice(0, 3).map(([type, weight]) => ({ type, affinity: Math.round(weight * 100) }));
  res.json({ userId, topCulturalTags: topTags, topEventTypes, profileCompleteness: topTags.length > 0 ? 'active' : 'new' });
});

// ---------------------------------------------------------------------------
// Community graph
// ---------------------------------------------------------------------------

app.get('/api/communities/:id/members', (req, res) => {
  const community = profiles.find((p) => p.id === qparam(req.params.id) && p.entityType === 'community');
  if (!community) return res.status(404).json({ error: 'Community not found' });
  res.json(users.map((u) => ({ id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl })));
});
app.get('/api/communities/:id/recommended-events', (req, res) => {
  const community = profiles.find((p) => p.id === qparam(req.params.id) && p.entityType === 'community');
  if (!community) return res.status(404).json({ error: 'Community not found' });
  const communityEvents = events.filter((e) => !e.deletedAt && (e.communityTag?.toLowerCase() === community.category?.toLowerCase() || e.cultureTag?.some((t) => t.toLowerCase() === community.category?.toLowerCase())));
  res.json(communityEvents.slice(0, 10));
});
app.get('/api/users/:id/communities', (req, res) => {
  const user = users.find((u) => u.id === qparam(req.params.id));
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(profiles.filter((p) => p.entityType === 'community').slice(0, 5));
});
app.post('/api/communities/:id/join', requireAuth, async (req, res) => {
  const communityId = qparam(req.params.id);
  const uid = req.user!.id;
  try {
    if (hasFirestoreProject) {
      const profile = await profilesService.getById(communityId);
      if (!profile || profile.entityType !== 'community') {
        return res.status(404).json({ error: 'Community not found' });
      }
      await Promise.all([
        db.collection('users').doc(uid).update({
          joinedCommunities: firestore.FieldValue.arrayUnion(communityId),
        }),
        db.collection('profiles').doc(communityId).update({
          memberCount: firestore.FieldValue.increment(1),
        }),
      ]);
      return res.json({ success: true, communityId });
    }
    const community = profiles.find((p) => p.id === communityId && p.entityType === 'community');
    if (!community) return res.status(404).json({ error: 'Community not found' });
    return res.json({ success: true, communityId: community.id });
  } catch (err) {
    console.error('[POST /api/communities/:id/join]:', err);
    return res.status(500).json({ error: 'Failed to join community' });
  }
});
app.delete('/api/communities/:id/leave', requireAuth, async (req, res) => {
  const communityId = qparam(req.params.id);
  const uid = req.user!.id;
  try {
    if (hasFirestoreProject) {
      const profile = await profilesService.getById(communityId);
      if (!profile || profile.entityType !== 'community') {
        return res.status(404).json({ error: 'Community not found' });
      }
      await Promise.all([
        db.collection('users').doc(uid).update({
          joinedCommunities: firestore.FieldValue.arrayRemove(communityId),
        }),
        db.collection('profiles').doc(communityId).update({
          memberCount: firestore.FieldValue.increment(-1),
        }),
      ]);
      return res.json({ success: true });
    }
    const community = profiles.find((p) => p.id === communityId && p.entityType === 'community');
    if (!community) return res.status(404).json({ error: 'Community not found' });
    return res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/communities/:id/leave]:', err);
    return res.status(500).json({ error: 'Failed to leave community' });
  }
});

// ---------------------------------------------------------------------------
// Event Feedback
// ---------------------------------------------------------------------------

app.post('/api/events/:id/feedback', requireAuth, async (req, res) => {
  const eventId = qparam(req.params.id);
  const event = events.find((e) => e.id === eventId && !e.deletedAt);
  if (!event && !hasFirestoreProject) return res.status(404).json({ error: 'Event not found' });

  let payload: z.infer<typeof eventFeedbackSchema>;
  try {
    payload = parseBody(eventFeedbackSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid feedback payload' });
  }

  const userId = req.user!.id;

  if (hasFirestoreProject) {
    try {
      const existingEvent = await eventsService.getById(eventId);
      if (!existingEvent) return res.status(404).json({ error: 'Event not found' });
      const feedback = await eventFeedbackService.upsert({
        eventId,
        userId,
        rating: payload.rating,
        comment: payload.comment,
        createdAt: nowIso(),
      });
      return res.json(feedback);
    } catch (err) {
      console.error('[POST /api/events/:id/feedback]:', err);
      return res.status(500).json({ error: 'Failed to submit feedback' });
    }
  }

  const existing = eventFeedbackStore.findIndex((f) => f.userId === userId && f.eventId === eventId);
  const fb = {
    id: existing >= 0 ? eventFeedbackStore[existing].id : randomUUID(),
    eventId,
    userId,
    rating: payload.rating,
    comment: payload.comment ? String(payload.comment) : undefined,
    createdAt: nowIso(),
  };
  if (existing >= 0) eventFeedbackStore[existing] = fb; else eventFeedbackStore.push(fb);
  return res.json(fb);
});
app.get('/api/events/:id/feedback', async (req, res) => {
  if (hasFirestoreProject) {
    try {
      const feedback = await eventFeedbackService.listForEvent(qparam(req.params.id));
      const avg = feedback.length > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : null;
      return res.json({ feedback, averageRating: avg ? Math.round(avg * 10) / 10 : null, count: feedback.length });
    } catch (err) {
      console.error('[GET /api/events/:id/feedback]:', err);
      return res.status(500).json({ error: 'Failed to fetch feedback' });
    }
  }
  const feedback = eventFeedbackStore.filter((f) => f.eventId === qparam(req.params.id));
  const avg = feedback.length > 0 ? feedback.reduce((s, f) => s + f.rating, 0) / feedback.length : null;
  res.json({ feedback, averageRating: avg ? Math.round(avg * 10) / 10 : null, count: feedback.length });
});

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

app.get('/api/search', (req, res) => {
  const query = parseSearchQuery(req);
  if (!query.q) return res.json({ total: 0, page: query.page, pageSize: query.pageSize, results: [] });
  const key = `search:${buildSearchCacheKey(query)}`;
  const cached = searchCache.get<ReturnType<typeof runSearch>>(key);
  if (cached) return res.json({ ...cached, cached: true });
  const payload = runSearch(getSearchCorpus(), query);
  searchCache.set(key, payload, 45_000);
  return res.json({ ...payload, cached: false });
});
app.get('/api/search/suggest', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (!q) return res.json({ suggestions: [] });
  const key = `search:suggest:${q.toLowerCase()}`;
  const cached = searchCache.get<string[]>(key);
  if (cached) return res.json({ suggestions: cached, cached: true });
  const suggestions = runSuggest(getSearchCorpus(), q, 8);
  searchCache.set(key, suggestions, 30_000);
  return res.json({ suggestions, cached: false });
});

// ---------------------------------------------------------------------------
// Stripe: Checkout, Refund, Webhook
// ---------------------------------------------------------------------------

app.post('/api/stripe/create-checkout-session', requireAuth, async (req: Request, res: Response) => {
  let payload: z.infer<typeof stripeCheckoutSchema>;
  try {
    payload = parseBody(stripeCheckoutSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid checkout payload' });
  }
  const ticketData = payload.ticketData;
  const draftId = randomUUID();
  const createdAt = nowIso();
  const draft: AppTicket & { paymentStatus: AppTicket['paymentStatus'] } = {
    id: draftId, userId: req.user!.id, eventId: String(ticketData.eventId ?? ''),
    eventTitle: String(ticketData.eventTitle ?? 'Event'), eventDate: String(ticketData.eventDate ?? ''), eventTime: String(ticketData.eventTime ?? ''), eventVenue: String(ticketData.eventVenue ?? ''),
    tierName: String(ticketData.tierName ?? 'General'), quantity: Number(ticketData.quantity ?? 1), totalPriceCents: Number(ticketData.totalPriceCents ?? 0),
    currency: String(ticketData.currency ?? 'AUD').toUpperCase(), status: 'confirmed' as TicketStatus, paymentStatus: 'pending', priority: 'normal',
    imageColor: ticketData.imageColor ?? undefined, createdAt, ticketCode: `CP-T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    history: [{ at: createdAt, status: 'confirmed' as TicketStatus, note: 'Draft created, awaiting payment' }], staffAuditTrail: [],
  };
  if (hasFirestoreProject) {
    await db.collection('tickets').doc(draftId).set({
      ...draft,
      qrCode: draft.ticketCode,
      cpTicketId: draft.ticketCode,
      priceCents: draft.totalPriceCents,
      updatedAt: createdAt,
      history: [{ action: 'checkout_started', timestamp: createdAt, actorId: req.user!.id }],
    });
  } else {
    tickets.push(draft);
  }

  if (stripeClient) {
    try {
      const appUrl = process.env.APP_URL ?? `https://${process.env.FIREBASE_CONFIG ? JSON.parse(process.env.FIREBASE_CONFIG).projectId + '.web.app' : 'localhost:5000'}`;
      const session = await stripeClient.checkout.sessions.create({
        mode: 'payment', payment_method_types: ['card'],
        line_items: [{ price_data: { currency: draft.currency.toLowerCase(), product_data: { name: `${draft.eventTitle} — ${draft.tierName}`, description: `${draft.quantity} × ticket(s) · ${draft.eventDate ?? 'Date TBA'}` }, unit_amount: draft.totalPriceCents }, quantity: 1 }],
        metadata: { ticketId: draft.id, userId: draft.userId, eventId: draft.eventId },
        success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&ticketId=${draft.id}`,
        cancel_url: `${appUrl}/payment/cancel?ticketId=${draft.id}`,
      });
      draft.stripePaymentIntentId = session.payment_intent ? String(session.payment_intent) : undefined;
      if (hasFirestoreProject) {
        await ticketsService.update(draft.id, {
          stripePaymentIntentId: draft.stripePaymentIntentId,
        });
      }
      return res.json({ checkoutUrl: session.url, ticketId: draft.id, sessionId: session.id, paymentIntentId: draft.stripePaymentIntentId });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.error('[stripe] checkout session error:', msg);
      if (hasFirestoreProject) {
        await db.collection('tickets').doc(draft.id).delete();
      } else {
        tickets.splice(tickets.indexOf(draft), 1);
      }
      return res.status(500).json({ error: 'Failed to create checkout session', detail: msg });
    }
  }

  draft.stripePaymentIntentId = `pi_mock_${draftId.slice(0, 8)}`;
  if (hasFirestoreProject) {
    await ticketsService.update(draft.id, { stripePaymentIntentId: draft.stripePaymentIntentId });
  }
  return res.json({ checkoutUrl: 'https://checkout.stripe.com/mock-session', ticketId: draft.id, paymentIntentId: draft.stripePaymentIntentId });
});

app.post('/api/stripe/refund', requireAuth, async (req: Request, res: Response) => {
  let payload: z.infer<typeof stripeRefundSchema>;
  try {
    payload = parseBody(stripeRefundSchema, req.body);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid refund payload' });
  }
  const ticketId = payload.ticketId;

  if (hasFirestoreProject) {
    const ticket = await ticketsService.getById(ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    if (!isOwnerOrAdmin(req.user!, ticket.userId)) return res.status(403).json({ error: 'Forbidden' });
    if (ticket.status === 'used') return res.status(400).json({ error: 'Cannot refund used ticket' });
    if (ticket.paymentStatus === 'refunded') return res.status(400).json({ error: 'Already refunded' });

    const quantity = Number((ticket as unknown as { quantity?: number }).quantity ?? 1);
    const totalPriceCents = Number((ticket as unknown as { totalPriceCents?: number }).totalPriceCents ?? ticket.priceCents * quantity);
    const eventTitle = String((ticket as unknown as { eventTitle?: string }).eventTitle ?? 'Event');

    if (stripeClient && ticket.stripePaymentIntentId && !ticket.stripePaymentIntentId.startsWith('pi_mock_')) {
      try {
        const refund = await stripeClient.refunds.create({ payment_intent: ticket.stripePaymentIntentId });
        await ticketsService.update(ticketId, { status: 'cancelled', paymentStatus: 'refunded' });
        await walletsService.addTransaction(ticket.userId, {
          type: 'refund',
          amountCents: totalPriceCents,
          description: `Refund: ${eventTitle}`,
        });
        return res.json({ ok: true, ticketId, refundId: refund.id });
      } catch (err: unknown) {
        const msg = (err as Error).message;
        console.error('[stripe] refund error:', msg);
        return res.status(500).json({ error: 'Stripe refund failed', detail: msg });
      }
    }

    await ticketsService.update(ticketId, { status: 'cancelled', paymentStatus: 'refunded' });
    await walletsService.addTransaction(ticket.userId, {
      type: 'refund',
      amountCents: totalPriceCents,
      description: `Refund: ${eventTitle}`,
    });
    return res.json({ ok: true, ticketId, refundId: `re_mock_${randomUUID().slice(0, 8)}` });
  }

  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (!isOwnerOrAdmin(req.user!, ticket.userId)) return res.status(403).json({ error: 'Forbidden' });
  if (ticket.status === 'used') return res.status(400).json({ error: 'Cannot refund used ticket' });
  if (ticket.paymentStatus === 'refunded') return res.status(400).json({ error: 'Already refunded' });

  if (stripeClient && ticket.stripePaymentIntentId && !ticket.stripePaymentIntentId.startsWith('pi_mock_')) {
    try {
      const refund = await stripeClient.refunds.create({ payment_intent: ticket.stripePaymentIntentId });
      ticket.status = 'cancelled'; ticket.paymentStatus = 'refunded';
      ticket.history.unshift({ at: nowIso(), status: 'cancelled', note: `Stripe refund ${refund.id}` });
      ticket.staffAuditTrail?.unshift({ at: nowIso(), by: 'system', action: 'stripe_refund_processed' });
      const tx = transactions.get(ticket.userId) ?? [];
      tx.unshift({ id: randomUUID(), type: 'refund', amountCents: ticket.totalPriceCents, createdAt: nowIso(), description: `Refund: ${ticket.eventTitle}` });
      transactions.set(ticket.userId, tx);
      return res.json({ ok: true, ticketId, refundId: refund.id });
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.error('[stripe] refund error:', msg);
      return res.status(500).json({ error: 'Stripe refund failed', detail: msg });
    }
  }

  ticket.status = 'cancelled'; ticket.paymentStatus = 'refunded';
  ticket.history.unshift({ at: nowIso(), status: 'cancelled', note: 'Refund processed (mock)' });
  ticket.staffAuditTrail?.unshift({ at: nowIso(), by: 'system', action: 'stripe_refund_processed' });
  const tx = transactions.get(ticket.userId) ?? [];
  tx.unshift({ id: randomUUID(), type: 'refund', amountCents: ticket.totalPriceCents, createdAt: nowIso(), description: `Refund: ${ticket.eventTitle}` });
  transactions.set(ticket.userId, tx);
  return res.json({ ok: true, ticketId, refundId: `re_mock_${randomUUID().slice(0, 8)}` });
});

app.post('/api/stripe/webhook', async (req: Request & { rawBody?: Buffer }, res: Response) => {
  const sig = req.headers['stripe-signature'];

  if (stripeClient && process.env.STRIPE_WEBHOOK_SECRET && req.rawBody && sig) {
    let event: Stripe.Event;
    try {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: unknown) {
      const msg = (err as Error).message;
      console.error('[stripe] webhook signature verification failed:', msg);
      return res.status(400).json({ error: `Webhook Error: ${msg}` });
    }

    // Idempotency: Ensure we only process each event once.
    const idempotencyRef = db.collection('stripeEvents').doc(event.id);
    try {
      await idempotencyRef.create({ receivedAt: nowIso(), type: event.type });
    } catch (error: unknown) {
      if ((error as Record<string, unknown>)?.code === 6) { // ALREADY_EXISTS
        console.log(`[stripe] webhook already processed: ${event.id}`);
        return res.json({ received: true, message: 'Already processed' });
      }
      console.error(`[stripe] idempotency check failed for event ${event.id}`, error);
      return res.status(500).json({ error: 'Idempotency check failed' });
    }

    const eventType = event.type;
    const obj = event.data.object as unknown as Record<string, unknown>;
    const meta = (obj?.metadata ?? {}) as Record<string, string>;
    const ticketId   = String(meta?.ticketId ?? '');
    const userIdMeta = String(meta?.userId ?? obj?.client_reference_id ?? '');

    try {
      if (hasFirestoreProject) {
        // ── Subscription events ──────────────────────────────────────────────
        if (eventType === 'checkout.session.completed' && obj.mode === 'subscription' && userIdMeta) {
          // Subscription checkout successful — activate membership
          const subscriptionId = String(obj.subscription ?? '');
          const expiresAt = subscriptionId
            ? await stripeClient!.subscriptions.retrieve(subscriptionId)
                .then((sub) => new Date((sub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString())
                .catch(() => undefined)
            : undefined;
          await usersService.upsert(userIdMeta, {
            stripeSubscriptionId: subscriptionId || undefined,
            membership: { tier: 'plus', isActive: true, expiresAt },
          });
          await authAdmin.setCustomUserClaims(userIdMeta, {
            ...(await authAdmin.getUser(userIdMeta)).customClaims,
            tier: 'plus',
          });

        } else if (eventType === 'customer.subscription.updated') {
          // Sync subscription status (e.g. billing period change, reactivation)
          const custId = String(obj.customer ?? '');
          if (custId) {
            const snap = await db.collection('users').where('stripeCustomerId', '==', custId).limit(1).get();
            if (!snap.empty) {
              const uid = snap.docs[0].id;
              const isActive = obj.status === 'active' || obj.status === 'trialing';
              const periodEnd = obj.current_period_end as number | undefined;
              const expiresAt = periodEnd
                ? new Date(periodEnd * 1000).toISOString()
                : undefined;
              await usersService.upsert(uid, {
                stripeSubscriptionId: String(obj.id),
                membership: { tier: isActive ? 'plus' : 'free', isActive, expiresAt },
              });
              await authAdmin.setCustomUserClaims(uid, {
                ...(await authAdmin.getUser(uid)).customClaims,
                tier: isActive ? 'plus' : 'free',
              });
            }
          }

        } else if (eventType === 'customer.subscription.deleted') {
          // Subscription cancelled or expired — downgrade
          const custId = String(obj.customer ?? '');
          if (custId) {
            const snap = await db.collection('users').where('stripeCustomerId', '==', custId).limit(1).get();
            if (!snap.empty) {
              const uid = snap.docs[0].id;
              await usersService.upsert(uid, {
                stripeSubscriptionId: undefined,
                membership: { tier: 'free', isActive: false },
              });
              await authAdmin.setCustomUserClaims(uid, {
                ...(await authAdmin.getUser(uid)).customClaims,
                tier: 'free',
              });
            }
          }

        } else if (eventType === 'invoice.payment_failed') {
          // Failed renewal — mark membership inactive but keep tier for grace period
          const custId = String(obj.customer ?? '');
          if (custId) {
            const snap = await db.collection('users').where('stripeCustomerId', '==', custId).limit(1).get();
            if (!snap.empty) {
              const uid = snap.docs[0].id;
              await usersService.upsert(uid, {
                membership: { tier: 'plus', isActive: false },
              });
            }
          }

        // ── Ticket (one-time payment) events ─────────────────────────────────
        } else if (ticketId) {
          if (
            (eventType === 'checkout.session.completed' && obj.mode === 'payment') ||
            eventType === 'payment_intent.succeeded'
          ) {
            const updatedTicket = await ticketsService.update(ticketId, {
              status: 'confirmed',
              paymentStatus: 'paid',
              stripePaymentIntentId: String(obj.payment_intent ?? obj.id ?? ''),
            });
            const ticketUserId = userIdMeta || updatedTicket?.userId;
            if (updatedTicket && ticketUserId) {
              const paidAmountCents = Number(
                obj.amount_total
                  ?? updatedTicket.totalPriceCents
                  ?? updatedTicket.priceCents
                  ?? 0
              );

              if (!updatedTicket.rewardPointsAwardedAt) {
                const rewardPoints = await awardRewardsPoints(ticketUserId, paidAmountCents, {
                  ticketId,
                  source: 'ticket payment',
                });
                if (rewardPoints > 0) {
                  await ticketsService.update(ticketId, {
                    rewardPointsEarned: rewardPoints,
                    rewardPointsAwardedAt: nowIso(),
                  });
                }
              }

              if (!updatedTicket.cashbackCreditedAt) {
                const memberUser = await usersService.getById(ticketUserId);
                const membership = memberUser?.membership;
                const membershipSummary = buildMembershipResponse({
                  tier: membership?.tier ?? 'free',
                  isActive: membership?.isActive ?? false,
                  expiresAt: membership?.expiresAt ?? null,
                });
                if (membershipSummary.cashbackRate > 0) {
                  const cashbackCents = Math.max(0, Math.round(paidAmountCents * membershipSummary.cashbackRate));
                  if (cashbackCents > 0) {
                    await walletsService.addTransaction(ticketUserId, {
                      type: 'cashback',
                      amountCents: cashbackCents,
                      description: `CulturePass+ cashback (${Math.round(membershipSummary.cashbackRate * 100)}%)`,
                    });
                    await ticketsService.update(ticketId, {
                      cashbackCents,
                      cashbackCreditedAt: nowIso(),
                    });
                    await notificationsService.create({
                      userId: ticketUserId,
                      title: 'Cashback credited',
                      message: `$${(cashbackCents / 100).toFixed(2)} was added to your wallet from CulturePass+ cashback.`,
                      type: 'cashback',
                      isRead: false,
                      metadata: { ticketId, cashbackCents },
                      createdAt: nowIso(),
                    });
                  }
                }
              }
            }
          } else if (eventType === 'charge.refunded') {
            await db.runTransaction(async (transaction) => {
              const ticketRef = db.collection('tickets').doc(ticketId);
              const ticketDoc = await transaction.get(ticketRef);
              if (!ticketDoc.exists) {
                console.warn(`[stripe] Refund webhook for non-existent ticket: ${ticketId}`);
                return;
              }
              const ticket = ticketDoc.data() as AppTicket;
              const quantity = ticket.quantity ?? 1;
              transaction.update(ticketRef, { status: 'cancelled', paymentStatus: 'refunded' });
              if (ticket.eventId) {
                transaction.update(db.collection('events').doc(ticket.eventId), {
                  attending: firestore.FieldValue.increment(-quantity),
                });
              }
            });
          }
        }
      } else {
        // ── Dev mode: Update in-memory ────────────────────────────────────────
        if (userIdMeta && (eventType === 'checkout.session.completed' && obj.mode === 'subscription')) {
          const m = memberships.get(userIdMeta);
          if (m) { m.tier = 'plus'; m.isActive = true; m.validUntil = new Date(Date.now() + 86400_000 * 30).toISOString(); }
        } else if (eventType === 'customer.subscription.deleted') {
          for (const m of memberships.values()) { m.tier = 'free'; m.isActive = false; }
        } else {
          const ticket = tickets.find((t) => t.id === ticketId);
          if (ticket) {
            if (eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
              ticket.status = 'confirmed'; ticket.paymentStatus = 'paid';
              ticket.stripePaymentIntentId = String(obj.payment_intent ?? obj.id ?? '');
              ticket.history.unshift({ at: nowIso(), status: 'confirmed', note: `Stripe event: ${eventType}` });
              if (!ticket.rewardPointsAwardedAt) {
                const rewardPoints = await awardRewardsPoints(ticket.userId, ticket.totalPriceCents, {
                  ticketId: ticket.id,
                  source: 'ticket payment',
                });
                if (rewardPoints > 0) {
                  ticket.rewardPointsEarned = rewardPoints;
                  ticket.rewardPointsAwardedAt = nowIso();
                }
              }
              const membership = memberships.get(ticket.userId);
              const membershipSummary = buildMembershipResponse({
                tier: membership?.tier ?? 'free',
                isActive: membership?.isActive ?? false,
                expiresAt: membership?.validUntil ?? null,
              });
              if (!ticket.cashbackCreditedAt && membershipSummary.cashbackRate > 0) {
                const cashbackCents = Math.max(0, Math.round(ticket.totalPriceCents * membershipSummary.cashbackRate));
                if (cashbackCents > 0) {
                  ticket.cashbackCents = cashbackCents;
                  ticket.cashbackCreditedAt = nowIso();
                  const wallet = wallets.get(ticket.userId);
                  if (wallet) wallet.balance += cashbackCents;
                  const tx = transactions.get(ticket.userId) ?? [];
                  tx.unshift({
                    id: randomUUID(),
                    type: 'cashback',
                    amountCents: cashbackCents,
                    createdAt: nowIso(),
                    description: `CulturePass+ cashback (${Math.round(membershipSummary.cashbackRate * 100)}%)`,
                  });
                  transactions.set(ticket.userId, tx);
                }
              }
            } else if (eventType === 'charge.refunded') {
              ticket.paymentStatus = 'refunded'; ticket.status = 'cancelled';
              ticket.history.unshift({ at: nowIso(), status: 'cancelled', note: 'Stripe webhook: charge refunded' });
            }
          }
        }
      }
      console.log(`[stripe] webhook handled: ${eventType}`);
      return res.json({ received: true });
    } catch (err) {
      console.error(`[stripe] webhook processing failed for event ${event.id}:`, err);
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  const eventType = String(req.body?.type ?? '');
  const ticketId = String(req.body?.data?.object?.metadata?.ticketId ?? '');
  const ticket = tickets.find((t) => t.id === ticketId);
  if (ticket) {
    if (eventType === 'payment_intent.succeeded' || eventType === 'checkout.session.completed') {
      ticket.status = 'confirmed';
      ticket.paymentStatus = 'paid';
      ticket.history.unshift({ at: nowIso(), status: 'confirmed', note: `Mock webhook: ${eventType}` });
      if (!ticket.rewardPointsAwardedAt) {
        const rewardPoints = await awardRewardsPoints(ticket.userId, ticket.totalPriceCents, {
          ticketId: ticket.id,
          source: 'ticket payment',
        });
        if (rewardPoints > 0) {
          ticket.rewardPointsEarned = rewardPoints;
          ticket.rewardPointsAwardedAt = nowIso();
        }
      }
      const membership = memberships.get(ticket.userId);
      const membershipSummary = buildMembershipResponse({
        tier: membership?.tier ?? 'free',
        isActive: membership?.isActive ?? false,
        expiresAt: membership?.validUntil ?? null,
      });
      if (!ticket.cashbackCreditedAt && membershipSummary.cashbackRate > 0) {
        const cashbackCents = Math.max(0, Math.round(ticket.totalPriceCents * membershipSummary.cashbackRate));
        if (cashbackCents > 0) {
          ticket.cashbackCents = cashbackCents;
          ticket.cashbackCreditedAt = nowIso();
          const wallet = wallets.get(ticket.userId);
          if (wallet) wallet.balance += cashbackCents;
          const tx = transactions.get(ticket.userId) ?? [];
          tx.unshift({
            id: randomUUID(),
            type: 'cashback',
            amountCents: cashbackCents,
            createdAt: nowIso(),
            description: `CulturePass+ cashback (${Math.round(membershipSummary.cashbackRate * 100)}%)`,
          });
          transactions.set(ticket.userId, tx);
        }
      }
    }
    if (eventType === 'charge.refunded') { ticket.paymentStatus = 'refunded'; ticket.status = 'cancelled'; ticket.history.unshift({ at: nowIso(), status: 'cancelled', note: 'Mock webhook: charge refunded' }); }
    ticket.staffAuditTrail?.unshift({ at: nowIso(), by: 'stripe_webhook', action: eventType });
  }
  return res.json({ received: true });
});
