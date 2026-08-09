const LOOPBACK = ["localhost", "127.0.0.1", "[::1]", "::1"];

/**
 * Decide which Convex URL the browser should actually connect to.
 *
 * A local Convex backend is configured as `http://127.0.0.1:3212`, which means
 * nothing on a phone — it would point the phone at itself. So when the app is
 * being served from some other host (a LAN IP, so players can scan the QR
 * code), rewrite the Convex host to match and keep the port. Cloud deployments
 * have a real hostname and are returned untouched.
 *
 * @param configured value of VITE_CONVEX_URL
 * @param servedFrom the hostname the page was loaded from (location.hostname)
 */
export function resolveConvexUrl(configured: string, servedFrom: string): string {
  try {
    const target = new URL(configured);
    if (LOOPBACK.includes(target.hostname) && !LOOPBACK.includes(servedFrom)) {
      target.hostname = servedFrom;
      return target.origin;
    }
  } catch {
    /* not a parseable URL — hand it to Convex as-is and let it complain */
  }
  return configured;
}
