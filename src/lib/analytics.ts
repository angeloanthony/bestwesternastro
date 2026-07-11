// Thin GA4 event helper for Preact islands — the programmatic mirror of the
// [data-track] click listener in Analytics.astro. Emits outcome-based events
// (which a click listener can't). No-op until `gtag` is configured, so nothing
// fires until measurement is provisioned (Analytics.astro stays dormant by default).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Record<string, unknown> = {}): void {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    window.gtag('event', event, { transport_type: 'beacon', ...params });
  }
}
