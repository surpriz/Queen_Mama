import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = (session.metadata?.plan === "ENTERPRISE" ? "ENTERPRISE" : "PRO") as "PRO" | "ENTERPRISE";

        if (userId && session.subscription) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription: any = await getStripe().subscriptions.retrieve(
            session.subscription as string
          );

          // Check for existing subscription and cancel it
          const existingSubscription = await prisma.subscription.findUnique({
            where: { userId },
          });

          if (existingSubscription?.stripeSubscriptionId &&
              existingSubscription.stripeSubscriptionId !== subscription.id) {
            // Cancel the old subscription on Stripe
            try {
              await getStripe().subscriptions.cancel(existingSubscription.stripeSubscriptionId);
              console.log(`[Webhook] Cancelled old subscription: ${existingSubscription.stripeSubscriptionId}`);
            } catch (error) {
              console.error(`[Webhook] Failed to cancel old subscription:`, error);
            }
          }

          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          });

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              plan,
              status: subscription.status === "trialing" ? "TRIALING" : "ACTIVE",
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
            update: {
              plan,
              status: subscription.status === "trialing" ? "TRIALING" : "ACTIVE",
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any;
        const existingSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (existingSub) {
          const status = subscription.status === "active" ? "ACTIVE" :
                         subscription.status === "canceled" ? "CANCELED" :
                         subscription.status === "past_due" ? "PAST_DUE" :
                         subscription.status === "trialing" ? "TRIALING" : "INCOMPLETE";

          // Check if subscription is scheduled for cancellation
          const willCancel = subscription.cancel_at_period_end || !!subscription.cancel_at;

          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status,
              cancelAtPeriodEnd: willCancel,
              currentPeriodStart: subscription.current_period_start
                ? new Date(subscription.current_period_start * 1000)
                : null,
              currentPeriodEnd: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000)
                : null,
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await prisma.subscription.update({
          where: { stripeSubscriptionId: subscription.id },
          data: {
            status: "CANCELED",
            plan: "FREE",
          },
        });
        break;
      }

      case "invoice.paid": {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const invoice = event.data.object as any;
        if (invoice.subscription) {
          const sub = await prisma.subscription.findUnique({
            where: { stripeSubscriptionId: invoice.subscription as string },
          });

          if (sub) {
            await prisma.invoice.upsert({
              where: { stripeInvoiceId: invoice.id },
              create: {
                subscriptionId: sub.id,
                stripeInvoiceId: invoice.id,
                amountPaid: invoice.amount_paid,
                currency: invoice.currency,
                status: invoice.status || "paid",
                invoicePdfUrl: invoice.invoice_pdf,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
                periodStart: new Date(invoice.period_start * 1000),
                periodEnd: new Date(invoice.period_end * 1000),
              },
              update: {
                amountPaid: invoice.amount_paid,
                status: invoice.status || "paid",
                invoicePdfUrl: invoice.invoice_pdf,
                hostedInvoiceUrl: invoice.hosted_invoice_url,
              },
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
