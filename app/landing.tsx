import { Redirect } from 'expo-router';

// Legacy route — redirects to the new /get2know page
export default function LandingRedirect() {
  return <Redirect href="/get2know" />;
}
