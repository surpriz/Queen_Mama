import { Container } from "@/components/ui";
import { Navbar } from "@/components/sections/Navbar";
import { Footer } from "@/components/sections/Footer";

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  description?: string;
  children: React.ReactNode;
}

export function LegalPageLayout({
  title,
  lastUpdated,
  description,
  children,
}: LegalPageLayoutProps) {
  return (
    <>
      <Navbar />
      <main className="pt-32 pb-24">
        <Container size="md">
          {/* Header */}
          <div className="mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              <span className="gradient-text">{title}</span>
            </h1>
            {lastUpdated && (
              <p className="text-[var(--qm-text-tertiary)] text-sm mb-4">
                Last updated: {lastUpdated}
              </p>
            )}
            {description && (
              <p className="text-lg text-[var(--qm-text-secondary)]">
                {description}
              </p>
            )}
          </div>

          {/* Content */}
          <div className="prose prose-invert prose-lg max-w-none">
            {children}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
