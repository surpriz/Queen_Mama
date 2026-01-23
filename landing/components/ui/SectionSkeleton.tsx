"use client";

interface SectionSkeletonProps {
  height?: string;
  className?: string;
}

export function SectionSkeleton({
  height = "400px",
  className = ""
}: SectionSkeletonProps) {
  return (
    <div
      className={`w-full animate-pulse ${className}`}
      style={{ minHeight: height }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        {/* Title skeleton */}
        <div className="flex flex-col items-center mb-12">
          <div className="h-4 w-24 bg-[var(--qm-surface-light)] rounded-full mb-4" />
          <div className="h-10 w-80 bg-[var(--qm-surface-light)] rounded-lg mb-4" />
          <div className="h-6 w-96 bg-[var(--qm-surface-light)] rounded-lg opacity-60" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-[var(--qm-surface-light)] rounded-2xl opacity-40"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
