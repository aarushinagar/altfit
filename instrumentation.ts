/**
 * instrumentation.ts — Next.js Instrumentation Hook
 *
 * Executed once per cold start, on the Node.js runtime only.
 * Triggers ALT FIT's self-configuration: bucket creation, RLS policies,
 * and broken URL cleanup — no manual steps required.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
    // Only run in the Node.js server runtime — not in Edge or browser
    if (process.env.NEXT_RUNTIME === "nodejs") {
        const { runStartupChecks } = await import("./lib/startup");
        await runStartupChecks();
    }
}
