// Queen Mama LITE - Auth Gate Component
// Handles device code flow authentication

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../ui/Button';

type AuthStep = 'idle' | 'waiting' | 'success' | 'error';

export function AuthGate() {
  const {
    deviceCode,
    isLoading,
    error,
    startDeviceCodeFlow,
    pollDeviceAuthorization,
    cancelDeviceCodeFlow,
    setError,
  } = useAuthStore();

  const [step, setStep] = useState<AuthStep>('idle');
  const [copied, setCopied] = useState(false);

  // Start auth flow
  const handleStartAuth = async () => {
    try {
      await startDeviceCodeFlow();
      setStep('waiting');
    } catch {
      setStep('error');
    }
  };

  // Poll for authorization
  useEffect(() => {
    if (!deviceCode || step !== 'waiting') return;

    const interval = setInterval(async () => {
      const authorized = await pollDeviceAuthorization();
      if (authorized) {
        setStep('success');
        clearInterval(interval);
      }
    }, deviceCode.interval * 1000);

    // Stop polling after expiration
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setError('Device code expired. Please try again.');
      setStep('error');
    }, deviceCode.expiresIn * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [deviceCode, step, pollDeviceAuthorization, setError]);

  // Copy user code to clipboard
  const copyCode = useCallback(() => {
    if (deviceCode?.userCode) {
      navigator.clipboard.writeText(deviceCode.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [deviceCode]);

  // Open verification URL
  const openVerificationUrl = useCallback(() => {
    if (deviceCode?.verificationUri) {
      window.open(deviceCode.verificationUri, '_blank');
    }
  }, [deviceCode]);

  // Cancel flow
  const handleCancel = () => {
    cancelDeviceCodeFlow();
    setStep('idle');
  };

  return (
    <div className="h-screen w-screen bg-qm-bg-primary flex items-center justify-center p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-qm-gradient flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-qm-text-primary">Queen Mama LITE</h1>
          <p className="text-qm-text-secondary mt-1">AI-powered coaching assistant</p>
        </div>

        <AnimatePresence mode="wait">
          {/* Idle State */}
          {step === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-qm-surface-medium rounded-xl p-6 border border-qm-border-subtle"
            >
              <h2 className="text-lg font-semibold text-qm-text-primary mb-2">
                Sign in to continue
              </h2>
              <p className="text-qm-body-sm text-qm-text-secondary mb-6">
                Connect your Queen Mama account to access AI coaching features.
              </p>
              <Button
                variant="primary"
                className="w-full"
                onClick={handleStartAuth}
                isLoading={isLoading}
              >
                Sign In
              </Button>
            </motion.div>
          )}

          {/* Waiting State - Device Code */}
          {step === 'waiting' && deviceCode && (
            <motion.div
              key="waiting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-qm-surface-medium rounded-xl p-6 border border-qm-border-subtle"
            >
              <h2 className="text-lg font-semibold text-qm-text-primary mb-4">
                Enter this code
              </h2>

              {/* User Code Display */}
              <button
                onClick={copyCode}
                className="w-full py-4 px-6 bg-qm-bg-primary rounded-lg border border-qm-border-medium mb-4 hover:border-qm-accent transition-colors"
              >
                <span className="text-3xl font-mono font-bold text-qm-accent tracking-wider">
                  {deviceCode.userCode}
                </span>
                <p className="text-qm-caption text-qm-text-tertiary mt-2">
                  {copied ? 'Copied!' : 'Click to copy'}
                </p>
              </button>

              <p className="text-qm-body-sm text-qm-text-secondary mb-4">
                Go to{' '}
                <button
                  onClick={openVerificationUrl}
                  className="text-qm-accent hover:underline"
                >
                  {deviceCode.verificationUri}
                </button>{' '}
                and enter the code above.
              </p>

              {/* Waiting indicator */}
              <div className="flex items-center gap-3 py-3 px-4 bg-qm-surface-light rounded-lg mb-4">
                <div className="w-2 h-2 rounded-full bg-qm-accent animate-pulse" />
                <span className="text-qm-body-sm text-qm-text-secondary">
                  Waiting for authorization...
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={openVerificationUrl}
                >
                  Open Browser
                </Button>
                <Button variant="ghost" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}

          {/* Error State */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-qm-surface-medium rounded-xl p-6 border border-qm-error/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-qm-error/15 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-qm-error"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-qm-text-primary">
                    Authentication Failed
                  </h2>
                  <p className="text-qm-body-sm text-qm-error">{error}</p>
                </div>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={handleStartAuth}
              >
                Try Again
              </Button>
            </motion.div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-qm-surface-medium rounded-xl p-6 border border-qm-success/30"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-qm-success/15 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-qm-success"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-qm-text-primary">
                    Welcome!
                  </h2>
                  <p className="text-qm-body-sm text-qm-success">
                    Successfully authenticated
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-qm-caption text-qm-text-tertiary mt-6">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}

export default AuthGate;
