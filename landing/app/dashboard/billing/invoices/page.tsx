import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { GlassCard, Badge } from "@/components/ui";

export const metadata = {
  title: "Invoices - Queen Mama",
  description: "View your billing history",
};

export default async function InvoicesPage() {
  const session = await auth();

  const subscription = await prisma.subscription.findUnique({
    where: { userId: session!.user.id },
    include: {
      invoices: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const invoices = subscription?.invoices || [];

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Invoice History</h1>
        <p className="mt-1 text-[var(--qm-text-secondary)]">
          View and download your past invoices
        </p>
      </div>

      <div className="max-w-4xl">
        <GlassCard hover={false} padding="none">
          {invoices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--qm-border-subtle)]">
                    <th className="text-left p-4 text-sm font-medium text-[var(--qm-text-tertiary)]">
                      Date
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--qm-text-tertiary)]">
                      Period
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--qm-text-tertiary)]">
                      Amount
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-[var(--qm-text-tertiary)]">
                      Status
                    </th>
                    <th className="text-right p-4 text-sm font-medium text-[var(--qm-text-tertiary)]">
                      Invoice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr
                      key={invoice.id}
                      className="border-b border-[var(--qm-border-subtle)] last:border-0"
                    >
                      <td className="p-4 text-sm text-white">
                        {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-4 text-sm text-[var(--qm-text-secondary)]">
                        {new Date(invoice.periodStart).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        -{" "}
                        {new Date(invoice.periodEnd).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="p-4 text-sm text-white">
                        {formatAmount(invoice.amountPaid, invoice.currency)}
                      </td>
                      <td className="p-4">
                        <Badge
                          variant={invoice.status === "paid" ? "success" : "default"}
                          size="sm"
                        >
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {invoice.invoicePdfUrl && (
                          <a
                            href={invoice.invoicePdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-[var(--qm-accent)] hover:text-[var(--qm-accent-light)]"
                          >
                            Download
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <svg
                className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-[var(--qm-text-secondary)]">No invoices yet</p>
              <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                Invoices will appear here once you upgrade to Pro
              </p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
