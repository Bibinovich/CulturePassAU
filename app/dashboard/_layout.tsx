import { Stack, Redirect } from 'expo-router';
import { useAuth } from '@/lib/auth';

/**
 * Dashboard layout — requires authentication.
 * Route-level role enforcement is handled server-side by API routes.
 * The organizer screen itself shows appropriate messaging for non-organizers.
 */
export default function DashboardLayout() {
  const { userId, isRestoring } = useAuth();

  // Wait for session to restore before redirecting
  if (isRestoring) return null;
  if (!userId) return <Redirect href="/(onboarding)/login" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="organizer" />
    </Stack>
  );
}
