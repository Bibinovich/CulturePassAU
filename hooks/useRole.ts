import { useAuth } from '@/lib/auth';
import type { UserRole } from '@/shared/schema';

const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  organizer: 1,
  business: 1,
  sponsor: 1,
  cityAdmin: 2,
  moderator: 3,
  admin: 4,
  platformAdmin: 4,
};

/**
 * Role-aware hook.
 *
 * Usage:
 *   const { isOrganizer, isAdmin, role } = useRole();
 *   if (!isOrganizer) return <AccessDenied />;
 */
export function useRole() {
  const { user, isAuthenticated, isLoading, isRestoring } = useAuth();
  const role: UserRole = (user?.role as UserRole) ?? 'user';

  return {
    role,
    isAuthenticated,
    isLoading: isLoading || isRestoring,
    /** rank ≥ organizer (organizer, business, sponsor, cityAdmin, moderator, admin, platformAdmin) */
    isOrganizer: isAuthenticated && ROLE_RANK[role] >= ROLE_RANK['organizer'],
    /** rank ≥ cityAdmin */
    isCityAdmin: isAuthenticated && ROLE_RANK[role] >= ROLE_RANK['cityAdmin'],
    /** rank ≥ moderator */
    isModerator: isAuthenticated && ROLE_RANK[role] >= ROLE_RANK['moderator'],
    /** rank ≥ admin */
    isAdmin: isAuthenticated && ROLE_RANK[role] >= ROLE_RANK['admin'],
    /** exact role match — use for specific roles like 'business' */
    hasRole: (...roles: UserRole[]) => isAuthenticated && roles.includes(role),
    /** rank comparison — use for "at least" checks */
    hasMinRole: (min: UserRole) => isAuthenticated && ROLE_RANK[role] >= ROLE_RANK[min],
  };
}
