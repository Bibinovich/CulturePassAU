/**
 * CulturePassAU — Typed API Client
 *
 * Wraps apiRequest() with structured error handling, typed responses,
 * and consistent route helpers. Use this instead of calling apiRequest()
 * directly in screens — it eliminates duplicated fetch logic and gives
 * you full TypeScript inference throughout the app.
 *
 * Usage:
 *   import { api } from '@/lib/api';
 *   const events = await api.events.list({ city: 'Sydney', page: 1 });
 */

import { apiRequest, getApiUrl } from './query-client';
import type {
  EventData,
  User,
  Ticket,
  PaginatedEventsResponse,
  Profile,
  Community,
} from '@/shared/schema';

// ---------------------------------------------------------------------------
// Local types for endpoints not yet in shared/schema.ts
// ---------------------------------------------------------------------------
export interface PerkData {
  id: string;
  title: string;
  description?: string;
  perkType?: string;
  discountPercent?: number;
  partnerId?: string;
  partnerName?: string;
  imageUrl?: string;
  status?: string;
  pointsCost?: number;
  usageLimit?: number;
  expiresAt?: string;
}

export interface PrivacySettings {
  /** Whether the user's profile is visible to others */
  profileVisible?: boolean;
  /** Alias used by some screens */
  profileVisibility?: boolean;
  activityVisible?: boolean;
  /** Alias used by some screens */
  activityStatus?: boolean;
  locationVisible?: boolean;
  /** Alias used by some screens */
  showLocation?: boolean;
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  marketingEmails?: boolean;
  showInDirectory?: boolean;
  /** Whether data is shared with partners */
  dataSharing?: boolean;
  [key: string]: boolean | undefined;
}

export interface MembershipSummary {
  tier: string;
  tierLabel: string;
  status: 'active' | 'inactive';
  expiresAt: string | null;
  cashbackRate: number;
  cashbackMultiplier: number;
  earlyAccessHours: number;
  eventsAttended: number;
}

export interface WalletTransaction {
  id: string;
  userId: string;
  type: 'topup' | 'payment' | 'refund' | 'cashback';
  amount: number;
  amountCents: number;
  currency: string;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  category: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface RewardsSummary {
  userId: string;
  points: number;
  pointsPerDollar: number;
  tier: 'silver' | 'gold' | 'diamond';
  tierLabel: string;
  nextTier: 'gold' | 'diamond' | null;
  nextTierLabel: string | null;
  pointsToNextTier: number;
  progressPercent: number;
}

export interface WalletSummary {
  id: string;
  userId: string;
  balance: number;
  balanceCents: number;
  currency: string;
  points: number;
  rewards?: RewardsSummary;
  transactions: WalletTransaction[];
}

// ---------------------------------------------------------------------------
// Structured error — always carry HTTP status for conditional handling
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNotFound() { return this.status === 404; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isServerError() { return this.status >= 500; }
  get isNetworkError() { return this.status === 0; }
}

// ---------------------------------------------------------------------------
// Internal helper — parse response and surface ApiError on failure
// ---------------------------------------------------------------------------
async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(res.status, `Non-JSON response: ${text.slice(0, 200)}`);
  }
}

async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  route: string,
  data?: unknown
): Promise<T> {
  try {
    const res = await apiRequest(method, route, data);
    return parseJson<T>(res);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error) {
      const match = err.message.match(/^(\d{3}):\s*(.*)/s);
      if (match) throw new ApiError(parseInt(match[1]), match[2]);
    }
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error');
  }
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
const auth = {
  me: () =>
    request<User>('GET', 'api/auth/me'),
};

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
export interface EventListParams {
  city?: string;
  country?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  search?: string;
}

const events = {
  list: (params: EventListParams = {}) => {
    const qs = new URLSearchParams();
    if (params.city) qs.set('city', params.city);
    if (params.country) qs.set('country', params.country);
    if (params.category) qs.set('category', params.category);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
    if (params.search) qs.set('search', params.search);
    const query = qs.toString();
    return request<PaginatedEventsResponse>('GET', `api/events${query ? `?${query}` : ''}`);
  },

  get: (id: string) =>
    request<EventData>('GET', `api/events/${id}`),

  create: (data: Partial<EventData>) =>
    request<EventData>('POST', 'api/events', data),

  update: (id: string, data: Partial<EventData>) =>
    request<EventData>('PUT', `api/events/${id}`, data),

  publish: (id: string) =>
    request<{ success: boolean }>('POST', `api/events/${id}/publish`),
};

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------
const tickets = {
  forUser: (userId: string) =>
    request<Ticket[]>('GET', `api/tickets/${userId}`),

  get: (id: string) =>
    request<Ticket>('GET', `api/ticket/${id}`),

  purchase: (data: { eventId: string; tierId?: string; quantity?: number }) =>
    request<Ticket>('POST', 'api/tickets', data),

  cancel: (id: string) =>
    request<{ success: boolean }>('PUT', `api/tickets/${id}/cancel`),

  scan: (data: { ticketCode: string; scannedBy?: string }) =>
    request<{ valid: boolean; message: string; outcome?: string; ticket?: Ticket }>('POST', 'api/tickets/scan', data),
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------
export interface SearchParams {
  q: string;
  type?: string;
  city?: string;
  country?: string;
  page?: number;
  pageSize?: number;
}

const search = {
  query: (params: SearchParams) => {
    const qs = new URLSearchParams({ q: params.q });
    if (params.type) qs.set('type', params.type);
    if (params.city) qs.set('city', params.city);
    if (params.country) qs.set('country', params.country);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
    return request<{ results: EventData[]; total: number }>('GET', `api/search?${qs}`);
  },

  suggest: (q: string) =>
    request<{ suggestions: string[] }>('GET', `api/search/suggest?q=${encodeURIComponent(q)}`),
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
const users = {
  get: (id: string) =>
    request<User>('GET', `api/users/${id}`),

  update: (id: string, data: Partial<User>) =>
    request<User>('PUT', `api/users/${id}`, data),
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
const notifications = {
  list: (userId: string) =>
    request<{ id: string; message: string; read: boolean; createdAt: string }[]>(
      'GET', `api/notifications/${userId}`
    ),

  unreadCount: (userId: string) =>
    request<{ count: number }>('GET', `api/notifications/${userId}/unread-count`),

  markRead: (notificationId: string) =>
    request<{ success: boolean }>('PUT', `api/notifications/${notificationId}/read`),

  markAllRead: (userId: string) =>
    request<{ success: boolean }>('PUT', `api/notifications/${userId}/read-all`),
};

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------
const membership = {
  get: (userId: string) =>
    request<MembershipSummary>(
      'GET', `api/membership/${userId}`
    ),

  memberCount: () =>
    request<{ count: number }>('GET', 'api/membership/member-count'),

  subscribe: (data: { billingPeriod: 'monthly' | 'yearly' }) =>
    request<{ checkoutUrl: string | null; sessionId?: string; devMode?: boolean; alreadyActive?: boolean; membership?: MembershipSummary }>(
      'POST', 'api/membership/subscribe', data
    ),

  cancel: () =>
    request<{ success: boolean; membership?: MembershipSummary }>('POST', 'api/membership/cancel-subscription'),
};

const wallet = {
  get: (userId: string) =>
    request<WalletSummary>('GET', `api/wallet/${userId}`),
  transactions: (userId: string) =>
    request<WalletTransaction[]>('GET', `api/transactions/${userId}`),
  topup: (userId: string, amount: number) =>
    request<WalletSummary>('POST', `api/wallet/${userId}/topup`, { amount }),
};

const rewards = {
  get: (userId: string) =>
    request<RewardsSummary>('GET', `api/rewards/${userId}`),
};

// ---------------------------------------------------------------------------
// Perks
// ---------------------------------------------------------------------------
const perks = {
  list: () => request<PerkData[]>('GET', 'api/perks'),

  get: (id: string) => request<PerkData>('GET', `api/perks/${id}`),

  redeem: (id: string) =>
    request<{ success: boolean; redemption?: Record<string, unknown> }>(
      'POST', `api/perks/${id}/redeem`
    ),
};

// ---------------------------------------------------------------------------
// Profiles (artist / business / venue / community directory)
// ---------------------------------------------------------------------------
const profiles = {
  list: (params?: { entityType?: string; city?: string; country?: string }) => {
    const qs = new URLSearchParams();
    if (params?.entityType) qs.set('entityType', params.entityType);
    if (params?.city) qs.set('city', params.city);
    if (params?.country) qs.set('country', params.country);
    const q = qs.toString();
    return request<Profile[]>('GET', `api/profiles${q ? `?${q}` : ''}`);
  },

  get: (id: string) => request<Profile>('GET', `api/profiles/${id}`),
};

// ---------------------------------------------------------------------------
// Communities
// ---------------------------------------------------------------------------
const communities = {
  list: (params?: { city?: string; country?: string }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set('city', params.city);
    if (params?.country) qs.set('country', params.country);
    const q = qs.toString();
    return request<Community[]>('GET', `api/communities${q ? `?${q}` : ''}`);
  },

  get: (id: string) => request<Community>('GET', `api/communities/${id}`),

  join: (id: string) =>
    request<{ success: boolean; communityId: string }>('POST', `api/communities/${id}/join`),

  leave: (id: string) =>
    request<{ success: boolean }>('DELETE', `api/communities/${id}/leave`),
};

// ---------------------------------------------------------------------------
// Privacy settings
// ---------------------------------------------------------------------------
const privacy = {
  get: (userId: string) =>
    request<PrivacySettings>('GET', `api/privacy/settings/${userId}`),

  update: (userId: string, data: Partial<PrivacySettings>) =>
    request<PrivacySettings>('PUT', `api/privacy/settings/${userId}`, data),
};

// ---------------------------------------------------------------------------
// Account management
// ---------------------------------------------------------------------------
const account = {
  delete: (userId: string) =>
    request<{ success: boolean }>('DELETE', `api/account/${userId}`),
};

// ---------------------------------------------------------------------------
// Directory — restaurants, shopping, movies, activities, businesses
// All follow the same list + get pattern
// ---------------------------------------------------------------------------
function directoryNamespace<T = Profile>(basePath: string) {
  return {
    list: (params?: Record<string, string>) => {
      const qs = params ? new URLSearchParams(params).toString() : '';
      return request<T[]>('GET', `${basePath}${qs ? `?${qs}` : ''}`);
    },
    get: (id: string) => request<T>('GET', `${basePath}/${id}`),
  };
}

const restaurants = directoryNamespace('api/restaurants');
const shopping    = directoryNamespace('api/shopping');
const movies      = directoryNamespace('api/movies');
const activities  = directoryNamespace('api/activities');
const businesses  = {
  ...directoryNamespace<Profile>('api/businesses'),
  /** List businesses, optionally filtering by location or sponsored-only */
  list: (params?: { city?: string; country?: string; sponsored?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set('city', params.city);
    if (params?.country) qs.set('country', params.country);
    if (params?.sponsored) qs.set('sponsored', 'true');
    const q = qs.toString();
    return request<Profile[]>('GET', `api/businesses${q ? `?${q}` : ''}`);
  },
};

// ---------------------------------------------------------------------------
// Locations (countries + cities for onboarding)
// ---------------------------------------------------------------------------
export interface LocationEntry {
  country: string;
  countryCode: string;
  cities: string[];
}

const locations = {
  list: () =>
    request<{ locations: LocationEntry[]; acknowledgementOfCountry: string }>('GET', 'api/locations'),
};

// ---------------------------------------------------------------------------
// CulturePass ID lookup
// ---------------------------------------------------------------------------
const cpid = {
  lookup: (id: string) =>
    request<{ cpid: string; name: string; username?: string; tier?: string; org?: string; avatarUrl?: string; city?: string; country?: string; bio?: string; targetId?: string; userId?: string }>('GET', `api/cpid/lookup/${encodeURIComponent(id)}`),
};

// ---------------------------------------------------------------------------
// Named export — single surface for all API calls
// ---------------------------------------------------------------------------
export const api = {
  auth,
  events,
  tickets,
  search,
  users,
  notifications,
  membership,
  wallet,
  rewards,
  perks,
  profiles,
  communities,
  privacy,
  account,
  restaurants,
  shopping,
  movies,
  activities,
  businesses,
  locations,
  cpid,
  /** Raw request — use when a specific endpoint isn't covered above */
  raw: request,
  /** Base URL — useful for constructing non-JSON endpoints (e.g. image URLs) */
  baseUrl: getApiUrl,
};
