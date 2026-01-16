import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DeviceAuthForm } from "./DeviceAuthForm";

export const metadata = {
  title: "Authorize Device - Queen Mama",
  description: "Authorize your macOS app to access your Queen Mama account",
};

export default async function DeviceAuthPage() {
  const session = await auth();

  // Redirect to signin if not authenticated
  if (!session?.user) {
    redirect("/signin?callbackUrl=/auth/device");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--qm-bg-primary)] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-full gradient-bg" />
            <span className="text-2xl font-bold gradient-text">Queen Mama</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Authorize Device</h1>
          <p className="text-[var(--qm-text-secondary)]">
            Enter the code shown on your Mac to connect it to your account
          </p>
        </div>

        <div className="bg-[var(--qm-surface-medium)] backdrop-blur-lg rounded-2xl border border-[var(--qm-border-subtle)] p-8">
          <DeviceAuthForm userName={session.user.name || session.user.email || "User"} />
        </div>

        <p className="mt-6 text-center text-[var(--qm-text-tertiary)] text-sm">
          Open the Queen Mama app on your Mac and select "Use Device Code" to get a code.
        </p>
      </div>
    </div>
  );
}
