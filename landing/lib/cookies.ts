// Cookie consent management
// GDPR-compliant cookie handling

export type CookieConsent = {
  necessary: boolean; // Always true - essential cookies
  analytics: boolean; // Google Analytics, etc.
  marketing: boolean; // Advertising cookies
  timestamp: number; // When consent was given
};

const CONSENT_COOKIE_NAME = "qm_cookie_consent";
const CONSENT_EXPIRY_DAYS = 365;

/**
 * Get the current cookie consent from the cookie
 */
export function getCookieConsent(): CookieConsent | null {
  if (typeof document === "undefined") return null;

  const cookie = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${CONSENT_COOKIE_NAME}=`));

  if (!cookie) return null;

  try {
    const value = decodeURIComponent(cookie.split("=")[1]);
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Set the cookie consent
 */
export function setCookieConsent(consent: Omit<CookieConsent, "necessary" | "timestamp">): void {
  if (typeof document === "undefined") return;

  const fullConsent: CookieConsent = {
    necessary: true, // Always required
    analytics: consent.analytics,
    marketing: consent.marketing,
    timestamp: Date.now(),
  };

  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + CONSENT_EXPIRY_DAYS);

  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(
    JSON.stringify(fullConsent)
  )}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;

  // Dispatch event for other parts of the app to react
  window.dispatchEvent(
    new CustomEvent("cookieConsentChanged", { detail: fullConsent })
  );
}

/**
 * Check if a specific type of cookie is allowed
 */
export function isCookieAllowed(type: "necessary" | "analytics" | "marketing"): boolean {
  const consent = getCookieConsent();
  if (!consent) return type === "necessary"; // Only necessary cookies before consent
  return consent[type] ?? false;
}

/**
 * Accept all cookies
 */
export function acceptAllCookies(): void {
  setCookieConsent({
    analytics: true,
    marketing: true,
  });
}

/**
 * Accept only necessary cookies
 */
export function acceptNecessaryCookies(): void {
  setCookieConsent({
    analytics: false,
    marketing: false,
  });
}

/**
 * Check if consent has been given (any choice made)
 */
export function hasConsentBeenGiven(): boolean {
  return getCookieConsent() !== null;
}
