import { track } from "@vercel/analytics";

export function trackEvent(name, properties = {}) {
  try {
    track(name, properties);
  } catch {}
}
