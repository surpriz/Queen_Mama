import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AUTH_CONSTANTS } from "@/lib/device-auth";
import { GlassCard } from "@/components/ui";
import { DeviceActions } from "./DeviceActions";

export const metadata = {
  title: "Devices - Queen Mama",
  description: "Manage the devices signed in to your Queen Mama account",
};

const MAX_DEVICES = AUTH_CONSTANTS.MAX_DEVICES_PER_USER;

function platformIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("ios") || p.includes("iphone") || p.includes("ipad")) {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z" />
    );
  }
  if (p.includes("win")) {
    return (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    );
  }
  // mac / default
  return (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  );
}

export default async function DevicesPage() {
  const session = await auth();

  const devices = await prisma.device.findMany({
    where: { userId: session!.user.id },
    orderBy: [{ isActive: "desc" }, { lastSeenAt: "desc" }],
    select: {
      id: true,
      name: true,
      platform: true,
      osVersion: true,
      appVersion: true,
      lastSeenAt: true,
      createdAt: true,
      isActive: true,
    },
  });

  const activeCount = devices.filter((d) => d.isActive).length;
  const atLimit = activeCount >= MAX_DEVICES;

  const formatDate = (date: Date) =>
    new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Devices</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          Manage the devices signed in to your account. You can use Queen Mama on up
          to {MAX_DEVICES} active devices at once.
        </p>
      </div>

      <GlassCard hover={false} padding="md">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-[var(--qm-text-secondary)]">Active devices</p>
            <p className="text-2xl font-bold text-white">
              {activeCount}
              <span className="text-base font-normal text-[var(--qm-text-tertiary)]">
                {" "}
                / {MAX_DEVICES}
              </span>
            </p>
          </div>
          {atLimit && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3l-6.93-12a2 2 0 00-3.48 0l-6.93 12a2 2 0 001.74 3z" />
              </svg>
              Limit reached — sign out or remove a device to add a new one.
            </div>
          )}
        </div>
      </GlassCard>

      {devices.length > 0 ? (
        <div className="space-y-4">
          {devices.map((d) => (
            <GlassCard key={d.id} hover={false} padding="md">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <span
                    className={
                      d.isActive
                        ? "text-[var(--qm-accent)]"
                        : "text-[var(--qm-text-tertiary)]"
                    }
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      {platformIcon(d.platform)}
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-medium text-white truncate">{d.name}</h3>
                      <span
                        className={
                          "px-2 py-0.5 rounded-full text-xs font-medium " +
                          (d.isActive
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-[var(--qm-surface-hover)] text-[var(--qm-text-tertiary)]")
                        }
                      >
                        {d.isActive ? "Active" : "Signed out"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--qm-text-tertiary)]">
                      <span>{d.platform}</span>
                      {d.osVersion && <span>{d.osVersion}</span>}
                      {d.appVersion && <span>v{d.appVersion}</span>}
                      <span>Last seen {formatDate(d.lastSeenAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="shrink-0">
                  <DeviceActions deviceId={d.id} deviceName={d.name} isActive={d.isActive} />
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      ) : (
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-[var(--qm-text-tertiary)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No devices yet</h3>
            <p className="text-[var(--qm-text-secondary)] max-w-md mx-auto">
              Devices appear here once you sign in to Queen Mama on your Mac, iPhone,
              or PC with this account.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
