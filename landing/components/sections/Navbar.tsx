"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Container, GradientButton, Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import Link from "next/link";

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const isAuthenticated = status === "authenticated" && session?.user;

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={cn(
        "fixed top-0 left-0 right-0 z-50",
        "transition-all duration-300",
        isScrolled
          ? "bg-[var(--qm-bg-primary)]/80 backdrop-blur-xl border-b border-[var(--qm-border-subtle)]"
          : "bg-transparent"
      )}
    >
      <Container>
        <nav className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-full gradient-bg flex items-center justify-center shadow-[var(--qm-shadow-glow)]">
              <svg
                className="w-4 h-4 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <span className="text-xl font-bold gradient-text group-hover:opacity-80 transition-opacity">
              Queen Mama
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[var(--qm-text-secondary)] hover:text-white transition-colors text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <GradientButton size="sm" variant="secondary">
                    Dashboard
                  </GradientButton>
                </Link>
                <Link href="/dashboard" className="flex items-center gap-2">
                  <Avatar
                    src={session.user.image}
                    fallback={session.user.name || session.user.email || "U"}
                    size="sm"
                  />
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/signin"
                  className="text-[var(--qm-text-secondary)] hover:text-white transition-colors text-sm font-medium px-3 py-2"
                >
                  Sign In
                </Link>
                <Link href="/signup">
                  <GradientButton size="sm" variant="secondary">
                    Sign Up
                  </GradientButton>
                </Link>
              </>
            )}
            <GradientButton size="sm">
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </GradientButton>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 text-[var(--qm-text-secondary)] hover:text-white"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </nav>
      </Container>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[var(--qm-bg-secondary)] border-b border-[var(--qm-border-subtle)]"
          >
            <Container>
              <div className="py-4 space-y-4">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block text-[var(--qm-text-secondary)] hover:text-white transition-colors py-2"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="pt-4 border-t border-[var(--qm-border-subtle)] space-y-3">
                  {isAuthenticated ? (
                    <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)}>
                      <GradientButton className="w-full" size="md">
                        Go to Dashboard
                      </GradientButton>
                    </Link>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <Link
                          href="/signin"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-center px-4 py-2.5 rounded-full text-sm font-medium text-[var(--qm-text-secondary)] hover:text-white bg-[var(--qm-surface-medium)] hover:bg-[var(--qm-surface-hover)] transition-colors"
                        >
                          Sign In
                        </Link>
                        <Link href="/signup" onClick={() => setIsMobileMenuOpen(false)}>
                          <GradientButton size="sm" variant="secondary" className="w-full">
                            Sign Up
                          </GradientButton>
                        </Link>
                      </div>
                    </>
                  )}
                  <GradientButton className="w-full" size="md">
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download Free
                  </GradientButton>
                </div>
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
