import { stripe } from "@/lib/stripe";
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
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;

        if (userId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          await prisma.user.update({
            where: { id: userId },
            data: { stripeCustomerId: session.customer as string },
          });

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              plan: "PRO",
              status: "ACTIVE",
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
            update: {
              plan: "PRO",
              status: "ACTIVE",
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0].price.id,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const existingSub = await prisma.subscription.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });

        if (existingSub) {
          const status = subscription.status === "active" ? "ACTIVE" :
                         subscription.status === "canceled" ? "CANCELED" :
                         subscription.status === "past_due" ? "PAST_DUE" :
                         subscription.status === "trialing" ? "TRIALING" : "INCOMPLETE";

          await prisma.subscription.update({
            where: { stripeSubscriptionId: subscription.id },
            data: {
              status,
              cancelAtPeriodEnd: subscription.cancel_at_period_end,
              currentPeriodStart: new Date(
                subscription.current_period_start * 1000
              ),
              currentPeriodEnd: new Date(
                subscription.current_period_end * 1000
              ),
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
        const invoice = event.data.object as Stripe.Invoice;
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
