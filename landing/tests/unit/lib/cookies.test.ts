// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getCookieConsent,
  setCookieConsent,
  isCookieAllowed,
  acceptAllCookies,
  acceptNecessaryCookies,
  hasConsentBeenGiven,
} from "@/lib/cookies";

describe("cookies", () => {
  beforeEach(() => {
    // Clear all cookies before each test
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0].trim();
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    });
  });

  // =========================================
  // getCookieConsent
  // =========================================
  describe("getCookieConsent", () => {
    it("should return null when no consent cookie exists", () => {
      const consent = getCookieConsent();
      expect(consent).toBeNull();
    });

    it("should parse stored consent cookie", () => {
      const consentData = {
        necessary: true,
        analytics: true,
        marketing: false,
        timestamp: Date.now(),
      };
      document.cookie = `qm_cookie_consent=${encodeURIComponent(
        JSON.stringify(consentData)
      )}; path=/`;

      const consent = getCookieConsent();
      expect(consent).not.toBeNull();
      expect(consent!.necessary).toBe(true);
      expect(consent!.analytics).toBe(true);
      expect(consent!.marketing).toBe(false);
    });

    it("should return null for malformed cookie data", () => {
      document.cookie = "qm_cookie_consent=not-valid-json; path=/";

      const consent = getCookieConsent();
      expect(consent).toBeNull();
    });
  });

  // =========================================
  // setCookieConsent
  // =========================================
  describe("setCookieConsent", () => {
    it("should set consent cookie with necessary always true", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      setCookieConsent({ analytics: true, marketing: false });

      const consent = getCookieConsent();
      expect(consent).not.toBeNull();
      expect(consent!.necessary).toBe(true);
      expect(consent!.analytics).toBe(true);
      expect(consent!.marketing).toBe(false);
      expect(consent!.timestamp).toBeDefined();

      dispatchSpy.mockRestore();
    });

    it("should dispatch cookieConsentChanged event", () => {
      const dispatchSpy = vi.spyOn(window, "dispatchEvent");

      setCookieConsent({ analytics: false, marketing: false });

      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0][0] as CustomEvent;
      expect(event.type).toBe("cookieConsentChanged");
      expect(event.detail.necessary).toBe(true);

      dispatchSpy.mockRestore();
    });

    it("should overwrite previous consent", () => {
      setCookieConsent({ analytics: false, marketing: false });
      let consent = getCookieConsent();
      expect(consent!.analytics).toBe(false);

      setCookieConsent({ analytics: true, marketing: true });
      consent = getCookieConsent();
      expect(consent!.analytics).toBe(true);
      expect(consent!.marketing).toBe(true);
    });
  });

  // =========================================
  // isCookieAllowed
  // =========================================
  describe("isCookieAllowed", () => {
    it("should always allow necessary cookies even without consent", () => {
      expect(isCookieAllowed("necessary")).toBe(true);
    });

    it("should disallow analytics before consent is given", () => {
      expect(isCookieAllowed("analytics")).toBe(false);
    });

    it("should disallow marketing before consent is given", () => {
      expect(isCookieAllowed("marketing")).toBe(false);
    });

    it("should allow analytics when consent is given", () => {
      setCookieConsent({ analytics: true, marketing: false });

      expect(isCookieAllowed("analytics")).toBe(true);
      expect(isCookieAllowed("marketing")).toBe(false);
    });

    it("should allow marketing when consent is given", () => {
      setCookieConsent({ analytics: false, marketing: true });

      expect(isCookieAllowed("marketing")).toBe(true);
      expect(isCookieAllowed("analytics")).toBe(false);
    });
  });

  // =========================================
  // acceptAllCookies
  // =========================================
  describe("acceptAllCookies", () => {
    it("should set analytics and marketing to true", () => {
      acceptAllCookies();

      const consent = getCookieConsent();
      expect(consent!.necessary).toBe(true);
      expect(consent!.analytics).toBe(true);
      expect(consent!.marketing).toBe(true);
    });
  });

  // =========================================
  // acceptNecessaryCookies
  // =========================================
  describe("acceptNecessaryCookies", () => {
    it("should set analytics and marketing to false", () => {
      acceptNecessaryCookies();

      const consent = getCookieConsent();
      expect(consent!.necessary).toBe(true);
      expect(consent!.analytics).toBe(false);
      expect(consent!.marketing).toBe(false);
    });
  });

  // =========================================
  // hasConsentBeenGiven
  // =========================================
  describe("hasConsentBeenGiven", () => {
    it("should return false when no consent was given", () => {
      expect(hasConsentBeenGiven()).toBe(false);
    });

    it("should return true after accepting all cookies", () => {
      acceptAllCookies();
      expect(hasConsentBeenGiven()).toBe(true);
    });

    it("should return true after accepting necessary only", () => {
      acceptNecessaryCookies();
      expect(hasConsentBeenGiven()).toBe(true);
    });
  });
});
