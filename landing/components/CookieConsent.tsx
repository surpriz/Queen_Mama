"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  hasConsentBeenGiven,
  acceptAllCookies,
  acceptNecessaryCookies,
  setCookieConsent,
  getCookieConsent,
  type CookieConsent as CookieConsentType,
} from "@/lib/cookies";

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false);
  const [showPreferences, setShowPreferences] = useState(false);
  const [preferences, setPreferences] = useState({
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if consent has already been given
    const hasConsent = hasConsentBeenGiven();
    if (!hasConsent) {
      // Small delay for better UX (don't show immediately on page load)
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAcceptAll = () => {
    acceptAllCookies();
    setIsVisible(false);
  };

  const handleAcceptNecessary = () => {
    acceptNecessaryCookies();
    setIsVisible(false);
  };

  const handleSavePreferences = () => {
    setCookieConsent(preferences);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="glass-card p-6 shadow-lg border border-[var(--qm-border-medium)]">
          {!showPreferences ? (
            // Main consent banner
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2">
                  We value your privacy
                </h3>
                <p className="text-sm text-[var(--qm-text-secondary)]">
                  We use cookies to enhance your browsing experience, analyze
                  site traffic, and personalize content. By clicking
                  &ldquo;Accept All&rdquo;, you consent to our use of cookies.{" "}
                  <Link
                    href="/privacy"
                    className="text-[var(--qm-accent)] hover:underline"
                  >
                    Learn more
                  </Link>
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="px-4 py-2 text-sm font-medium text-[var(--qm-text-secondary)] hover:text-white transition-colors"
                >
                  Customize
                </button>
                <button
                  onClick={handleAcceptNecessary}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--qm-surface-medium)] text-white hover:bg-[var(--qm-surface-hover)] transition-colors border border-[var(--qm-border-subtle)]"
                >
                  Necessary Only
                </button>
                <button
                  onClick={handleAcceptAll}
                  className="px-4 py-2 text-sm font-medium rounded-lg gradient-bg text-white hover:opacity-90 transition-opacity"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            // Preferences panel
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">
                  Cookie Preferences
                </h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-[var(--qm-text-tertiary)] hover:text-white"
                  aria-label="Close preferences"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4 mb-6">
                {/* Necessary cookies - always on */}
                <div className="flex items-start gap-4 p-3 rounded-lg bg-[var(--qm-surface-light)]">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-white">
                        Necessary Cookies
                      </h4>
                      <span className="text-xs px-2 py-0.5 rounded bg-[var(--qm-success-light)] text-[var(--qm-success)]">
                        Always Active
                      </span>
                    </div>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                      Essential for the website to function properly. Cannot be
                      disabled.
                    </p>
                  </div>
                </div>

                {/* Analytics cookies */}
                <label className="flex items-start gap-4 p-3 rounded-lg bg-[var(--qm-surface-light)] cursor-pointer hover:bg-[var(--qm-surface-medium)] transition-colors">
                  <div className="flex-1">
                    <h4 className="font-medium text-white">
                      Analytics Cookies
                    </h4>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                      Help us understand how visitors interact with our website
                      to improve user experience.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) =>
                        setPreferences((p) => ({
                          ...p,
                          analytics: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--qm-surface-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--qm-accent)]"></div>
                  </div>
                </label>

                {/* Marketing cookies */}
                <label className="flex items-start gap-4 p-3 rounded-lg bg-[var(--qm-surface-light)] cursor-pointer hover:bg-[var(--qm-surface-medium)] transition-colors">
                  <div className="flex-1">
                    <h4 className="font-medium text-white">
                      Marketing Cookies
                    </h4>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                      Used to deliver personalized advertisements and track
                      campaign effectiveness.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) =>
                        setPreferences((p) => ({
                          ...p,
                          marketing: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[var(--qm-surface-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--qm-accent)]"></div>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={handleAcceptNecessary}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--qm-surface-medium)] text-white hover:bg-[var(--qm-surface-hover)] transition-colors border border-[var(--qm-border-subtle)]"
                >
                  Reject All
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="px-4 py-2 text-sm font-medium rounded-lg gradient-bg text-white hover:opacity-90 transition-opacity"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
