import { Redirect } from 'expo-router';

// Root entry point — all platforms open directly on the Discovery tab.
// Guests can browse freely; protected features prompt sign-in inline.
export default function Index() {
  return <Redirect href="/(tabs)" />;
}
