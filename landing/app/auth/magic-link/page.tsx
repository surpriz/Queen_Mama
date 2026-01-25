"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const redirect = searchParams.get("redirect") || "/dashboard";

    if (!token) {
      setStatus("error");
      setErrorMessage("Missing token");
      return;
    }

    // Verify the magic link token
    fetch("/api/auth/magic-link/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, redirect }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus("success");
          // Redirect after a brief moment
          setTimeout(() => {
            router.push(redirect);
            router.refresh();
          }, 1000);
        } else {
          setStatus("error");
          setErrorMessage(data.message || "Invalid or expired link");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Connection error");
      });
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full border border-gray-700/50 text-center">
        {status === "verifying" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-purple-400 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Signing you in...</h1>
            <p className="text-gray-400">Please wait while we verify your link.</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome back!</h1>
            <p className="text-gray-400">Redirecting you now...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
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
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Link expired</h1>
            <p className="text-gray-400 mb-6">{errorMessage}</p>
            <a
              href="/signin"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              Sign in manually
            </a>
          </>
        )}
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
          <div className="text-white">Loading...</div>
        </div>
      }
    >
      <MagicLinkContent />
    </Suspense>
  );
}
