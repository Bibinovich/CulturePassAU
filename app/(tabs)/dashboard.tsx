import { Redirect } from 'expo-router';

/**
 * Tab stub — redirects to the organizer dashboard screen.
 * The tab bar entry is hidden for non-organizers via href: null in _layout.tsx.
 */
export default function DashboardTab() {
  return <Redirect href="/dashboard/organizer" />;
}
