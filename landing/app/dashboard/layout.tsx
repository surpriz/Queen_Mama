import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, DashboardNav } from "@/components/dashboard";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/signin");
  }

  return (
    <div className="min-h-screen bg-[var(--qm-bg-primary)]">
      <Sidebar />
      <div className="lg:pl-64">
        <DashboardNav user={session.user} />
        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
