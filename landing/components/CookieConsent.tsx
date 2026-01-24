"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  hasConsentBeenGiven,
  acceptAllCookies,
  acceptNecessaryCookies,
  setCookieConsent,
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
    <div
      className={`fixed bottom-6 right-6 z-50 w-full max-w-md transition-all duration-500 ease-out ${
        isVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div className="glass-card p-4 shadow-2xl border border-[var(--qm-border-medium)] backdrop-blur-xl">
        {!showPreferences ? (
          // Main consent banner - compact version
          <div className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white mb-1.5 flex items-center gap-2">
                🍪 We value your privacy
              </h3>
              <p className="text-xs text-[var(--qm-text-secondary)] leading-relaxed">
                We use cookies to enhance your experience.{" "}
                <Link
                  href="/privacy"
                  className="text-[var(--qm-accent)] hover:underline"
                >
                  Learn more
                </Link>
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleAcceptAll}
                className="w-full px-3 py-2 text-sm font-medium rounded-lg gradient-bg text-white hover:opacity-90 transition-opacity"
              >
                Accept All
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleAcceptNecessary}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--qm-surface-medium)] text-white hover:bg-[var(--qm-surface-hover)] transition-colors"
                >
                  Necessary Only
                </button>
                <button
                  onClick={() => setShowPreferences(true)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium text-[var(--qm-text-secondary)] hover:text-white transition-colors border border-[var(--qm-border-subtle)] rounded-md"
                >
                  Customize
                </button>
              </div>
            </div>
          </div>
        ) : (
            // Preferences panel - compact version
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-white">
                  Cookie Preferences
                </h3>
                <button
                  onClick={() => setShowPreferences(false)}
                  className="text-[var(--qm-text-tertiary)] hover:text-white"
                  aria-label="Close preferences"
                >
                  <svg
                    className="w-4 h-4"
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

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {/* Necessary cookies - always on */}
                <div className="p-2.5 rounded-md bg-[var(--qm-surface-light)]">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-medium text-white">
                      Necessary
                    </h4>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--qm-success-light)] text-[var(--qm-success)]">
                      Always On
                    </span>
                  </div>
                  <p className="text-xs text-[var(--qm-text-tertiary)] mt-1">
                    Essential for the website to function.
                  </p>
                </div>

                {/* Analytics cookies */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-md bg-[var(--qm-surface-light)] cursor-pointer hover:bg-[var(--qm-surface-medium)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white">
                      Analytics
                    </h4>
                    <p className="text-xs text-[var(--qm-text-tertiary)] mt-1">
                      Helps us improve your experience.
                    </p>
                  </div>
                  <div className="relative flex-shrink-0">
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
                    <div className="w-9 h-5 bg-[var(--qm-surface-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--qm-accent)]"></div>
                  </div>
                </label>

                {/* Marketing cookies */}
                <label className="flex items-start justify-between gap-3 p-2.5 rounded-md bg-[var(--qm-surface-light)] cursor-pointer hover:bg-[var(--qm-surface-medium)] transition-colors">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white">
                      Marketing
                    </h4>
                    <p className="text-xs text-[var(--qm-text-tertiary)] mt-1">
                      Personalized ads and tracking.
                    </p>
                  </div>
                  <div className="relative flex-shrink-0">
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
                    <div className="w-9 h-5 bg-[var(--qm-surface-hover)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--qm-accent)]"></div>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAcceptNecessary}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md bg-[var(--qm-surface-medium)] text-white hover:bg-[var(--qm-surface-hover)] transition-colors"
                >
                  Reject All
                </button>
                <button
                  onClick={handleSavePreferences}
                  className="flex-1 px-3 py-1.5 text-xs font-medium rounded-md gradient-bg text-white hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>
        )}
      </div>
    </div>
  );
}
