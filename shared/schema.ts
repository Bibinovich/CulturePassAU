/**
 * CulturePass AU — Shared Schema
 *
 * Canonical type definitions shared between the Express server and the
 * React Native / Web client.  No `[key: string]: any` — every field is
 * declared explicitly so TypeScript can catch mismatches at compile time.
 *
 * Database table definitions live in server/db/schema.ts (server-only).
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type MembershipTier = 'free' | 'plus' | 'elite' | 'pro' | 'premium' | 'vip';

/** Platform-level user roles for access control */
export type UserRole =
  | 'user'
  | 'organizer'
  | 'business'
  | 'sponsor'
  | 'cityAdmin'
  | 'platformAdmin'
  | 'moderator'
  | 'admin';

export type EntityType =
  | 'community'
  | 'business'
  | 'venue'
  | 'artist'
  | 'organisation';

export type TicketStatus = 'confirmed' | 'used' | 'cancelled' | 'expired';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface Deal {
  title: string;
  discount: string;
  validTill: string;
}

// ---------------------------------------------------------------------------
// Social links — index signature lets it be used as Record<string, string>
// ---------------------------------------------------------------------------

// SocialLinks is a Record<string, string> subtype so it's assignable wherever
// Record<string, string> is expected. Optional hints are for autocomplete only.
export type SocialLinks = Record<string, string> & {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  tiktok?: string;
  youtube?: string;
  linkedin?: string;
  website?: string;
};

/** Minimal shape for location-filtered lists (used by useLocationFilter) */
export interface Locatable {
  id: string;
  city: string;
  country: string;
}

// ---------------------------------------------------------------------------
// Core entities
// ---------------------------------------------------------------------------

export interface Membership {
  id: string;
  userId: string;
  tier: MembershipTier;
  validUntil?: string;
  isActive?: boolean;
  benefits?: string[];
}

export interface Wallet {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  points: number;
}

export interface User {
  id: string;
  username: string;
  displayName?: string;
  email?: string;
  avatarUrl?: string;
  city?: string;
  country?: string;
  bio?: string;
  interests?: string[];
  location?: string;
  socialLinks?: SocialLinks;
  isVerified?: boolean;
  isSydneyVerified?: boolean;
  culturePassId?: string;
  followersCount?: number;
  followingCount?: number;
  likesCount?: number;
  createdAt: string | null;
  website?: string;
  phone?: string;
  membership?: Membership;
  role?: UserRole;
}

export interface Profile {
  id: string;
  name: string;
  /** Some entity types (e.g. movies) use title as a primary display name */
  title?: string;
  type?: EntityType;
  entityType: string;
  description?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  avatarUrl?: string;
  posterUrl?: string;
  images?: string[];
  city?: string;
  country?: string;
  /** Human-readable location string e.g. "Sydney, NSW" */
  location?: string;
  /** Geo coordinates for map views */
  latitude?: number;
  longitude?: number;
  tags?: string[];
  isVerified?: boolean;
  verified?: boolean;
  followersCount?: number;
  likesCount?: number;
  membersCount?: number;
  reviewsCount?: number;
  rating?: number;
  category?: string;
  /** CulturePass entity ID */
  cpid?: string;
  culturePassId?: string;
  bio?: string;
  address?: string;
  openingHours?: string;
  /** Alias for openingHours — some screens use 'hours' */
  hours?: string;
  website?: string;
  email?: string;
  phone?: string;
  socialLinks?: SocialLinks;

  // ── Directory / business fields ──────────────────────────────────────────
  priceRange?: string;
  priceLabel?: string;
  color?: string;
  icon?: string;
  isOpen?: boolean;
  cuisine?: string;
  menuHighlights?: string[];
  deals?: Deal[];
  deliveryAvailable?: boolean;
  reservationAvailable?: boolean;
  reviews?: Array<{ id: string; userId: string; rating: number; comment?: string; createdAt?: string }>;
  services?: string[];

  // ── Indigenous / First Nations fields ────────────────────────────────────
  isIndigenousOwned?: boolean;
  indigenousCategory?: string;
  supplyNationRegistered?: boolean;

  // ── Movie / cinema fields ─────────────────────────────────────────────────
  genre?: string[];
  director?: string;
  cast?: string[];
  duration?: string;
  language?: string;
  imdbScore?: number;
  posterColor?: string;
  showtimes?: Array<{ time: string; cinema?: string; date?: string; price?: number }>;

  // ── Activity fields ───────────────────────────────────────────────────────
  isPopular?: boolean;
  ageGroup?: string;
  highlights?: string[];
  features?: string[];

  // ── Sponsorship ───────────────────────────────────────────────────────────
  isSponsored?: boolean;
  sponsorTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  ownerId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Community extends Omit<Profile, 'type'> {
  type: 'community';
  membersCount?: number;
  /** @deprecated use membersCount */
  memberCount?: number;
  category?: string;
  /** Subtype: diaspora | indigenous | cultural | sports | tech … */
  communityType?: string;
  iconEmoji?: string;
  isIndigenous?: boolean;
  countryOfOrigin?: string;
}

export interface Review {
  id: string;
  profileId: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: string | null;
}

// ---------------------------------------------------------------------------
// Ticketing
// ---------------------------------------------------------------------------

export interface TicketHistoryEntry {
  at: string;
  status: TicketStatus | string;
  note?: string;
}

export interface TicketAuditEntry {
  at: string;
  by: string;
  action: string;
}

export interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  title?: string;
  eventName?: string;
  eventTitle?: string;
  /** ISO date string e.g. "2026-03-15" */
  eventDate?: string;
  eventTime?: string;
  eventVenue?: string;
  date?: string;
  venue?: string;
  qrCode?: string;
  ticketCode?: string;
  tierName?: string;
  quantity?: number;
  totalPriceCents?: number;
  imageColor?: string;
  rewardPointsEarned?: number;
  rewardPointsAwardedAt?: string;
  status: TicketStatus | null;
  paymentStatus?: 'pending' | 'paid' | 'refunded' | 'failed';
  scannedAt?: string;
  history: TicketHistoryEntry[];
  staffAuditTrail?: TicketAuditEntry[];
}

// ---------------------------------------------------------------------------
// Events (shared client/server shape returned from the API)
// ---------------------------------------------------------------------------

export type EventType =
  | 'festival'
  | 'concert'
  | 'workshop'
  | 'puja'
  | 'sports'
  | 'food'
  | 'cultural'
  | 'community'
  | 'exhibition'
  | 'conference'
  | 'other';

export type AgeSuitability = 'all' | 'family' | '18+' | '21+';

export type PriceTier = 'free' | 'budget' | 'mid' | 'premium';

export interface EventData {
  id: string;
  cpid?: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  venue?: string;
  address?: string;
  priceCents?: number;
  priceLabel?: string;
  category?: string;
  communityTag?: string;
  organizer?: string;
  organizerId?: string;
  imageColor?: string;
  imageUrl?: string;
  capacity?: number;
  attending?: number;
  isFeatured?: boolean;
  isFree?: boolean;
  tiers?: Array<{ name: string; priceCents: number; available: number }>;
  country: string;
  city: string;
  tags?: string[];
  indigenousTags?: string[];
  languageTags?: string[];
  culturePassId?: string;
  /** Cultural community tags e.g. ["Malayali", "Tamil", "Sikh"] */
  cultureTag?: string[];
  /** 7-char geohash for proximity-based discovery e.g. "r1r0f3s" */
  geoHash?: string;
  eventType?: EventType;
  ageSuitability?: AgeSuitability;
  priceTier?: PriceTier;
  /** 0–100 reputation score of the organizer */
  organizerReputationScore?: number;
  /** External URL for tickets on organiser's own platform */
  externalTicketUrl?: string | null;
  /** ISO timestamp when event was soft-deleted */
  deletedAt?: string | null;
}

// ---------------------------------------------------------------------------
// New entities
// ---------------------------------------------------------------------------

export interface CulturalTag {
  id: string;
  name: string;
  slug: string;
  category?: string;
  iconUrl?: string;
}

export interface Organizer {
  id: string;
  name: string;
  reputationScore: number;
  verifiedAt?: string | null;
  contactEmail?: string;
  userId?: string;
}

export interface RecommendationProfile {
  userId: string;
  culturalTagWeights: Record<string, number>;
  eventTypeWeights: Record<string, number>;
  updatedAt: string;
}

export interface Location {
  id: string;
  name: string;
  geoHash: string;
  lat?: number;
  lng?: number;
  suburb?: string;
  state?: string;
}

export interface DiscoveryResult {
  event: EventData;
  matchScore: number;
  matchReason: string[];
}

/** Response envelope returned by GET /api/events when page/pageSize params are sent */
export interface PaginatedEventsResponse {
  events: EventData[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

// ---------------------------------------------------------------------------
// Content lifecycle status — used across events, perks, profiles, etc.
// ---------------------------------------------------------------------------

export type ContentStatus = 'active' | 'draft' | 'archived' | 'suspended';

// ---------------------------------------------------------------------------
// Geo / location hierarchy
// ---------------------------------------------------------------------------

export interface Country {
  id: string;
  name: string;
  code: string; // ISO 3166-1 alpha-2 e.g. "AU"
  flagEmoji?: string;
}

export interface City {
  id: string;
  name: string;
  countryId: string;
  countryCode: string;
  state?: string;
  lat?: number;
  lng?: number;
  geoHash?: string;
  timezone?: string;
  isActive: boolean;
}

// ---------------------------------------------------------------------------
// Artist
// ---------------------------------------------------------------------------

export interface Artist {
  id: string;
  name: string;
  bio?: string;
  genres?: string[];
  imageUrl?: string;
  coverImageUrl?: string;
  city?: string;
  country?: string;
  socialLinks?: SocialLinks;
  isVerified?: boolean;
  followersCount?: number;
  culturePassId?: string;
  ownerId?: string;
  status?: ContentStatus;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Venue
// ---------------------------------------------------------------------------

export interface Venue {
  id: string;
  name: string;
  address?: string;
  city?: string;
  country?: string;
  lat?: number;
  lng?: number;
  geoHash?: string;
  capacity?: number;
  imageUrl?: string;
  website?: string;
  phone?: string;
  isVerified?: boolean;
  culturePassId?: string;
  status?: ContentStatus;
}

// ---------------------------------------------------------------------------
// Sponsor
// ---------------------------------------------------------------------------

export interface Sponsor {
  id: string;
  name: string;
  logoUrl?: string;
  website?: string;
  description?: string;
  city?: string;
  country?: string;
  ownerId?: string;
  tier?: 'bronze' | 'silver' | 'gold' | 'platinum';
  isVerified?: boolean;
  status?: ContentStatus;
  createdAt?: string;
}

// ---------------------------------------------------------------------------
// Perk
// ---------------------------------------------------------------------------

export type PerkType =
  | 'discount_percent'
  | 'discount_fixed'
  | 'free_ticket'
  | 'early_access'
  | 'vip_upgrade'
  | 'cashback';

export interface Perk {
  id: string;
  title: string;
  description?: string;
  perkType: PerkType;
  discountPercent?: number;
  discountFixedCents?: number;
  providerType?: string;
  providerId?: string;
  providerName?: string;
  category?: string;
  isMembershipRequired?: boolean;
  requiredMembershipTier?: MembershipTier;
  usageLimit?: number;
  usedCount?: number;
  perUserLimit?: number;
  status?: ContentStatus;
  startDate?: string;
  endDate?: string;
  city?: string;
  country?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface PerkRedemption {
  id: string;
  perkId: string;
  userId: string;
  redeemedAt: string;
}

// ---------------------------------------------------------------------------
// Wallet + Transactions
// ---------------------------------------------------------------------------

export type TransactionType = 'charge' | 'refund' | 'debit' | 'cashback' | 'topup' | 'transfer';

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  amountCents: number;
  currency?: string;
  description: string;
  referenceId?: string;
  referenceType?: 'ticket' | 'perk' | 'membership' | 'topup';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'system'
  | 'event'
  | 'perk'
  | 'community'
  | 'payment'
  | 'follow'
  | 'review'
  | 'ticket'
  | 'membership';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Rewards
// ---------------------------------------------------------------------------

export type RewardsTier = 'standard' | 'silver' | 'gold' | 'diamond';

export interface RewardsAccount {
  userId: string;
  points: number;
  tier: RewardsTier;
  lifetimePoints: number;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Reports / moderation
// ---------------------------------------------------------------------------

export interface ContentReport {
  id: string;
  reporterId: string;
  targetId: string;
  targetType: 'event' | 'profile' | 'community' | 'user' | 'comment';
  reason: string;
  details?: string;
  status: ReportStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Follows / social graph
// ---------------------------------------------------------------------------

export interface Follow {
  id: string;
  followerId: string;
  targetId: string;
  targetType: 'user' | 'community' | 'artist' | 'profile';
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface MediaAttachment {
  id: string;
  targetType: string;
  targetId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  uploadedBy: string;
  createdAt: string;
}
