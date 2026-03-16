/**
 * Auth layout — wraps /signin, /register, /onboarding
 *
 * Provides a minimal full-screen container. Each auth component
 * manages its own visual layout; this group layout exists for:
 * - Route grouping (separate from the authenticated (app) group)
 * - Future shared auth metadata / page transitions
 */

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
