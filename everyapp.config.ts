import { defineEveryApp } from "@every-app/sdk";

export default defineEveryApp({
  id: "creator-storefront",
  name: "Creator Storefront",
  description:
    "Sell 1:1 sessions, live courses, recorded courses and digital files from a store page with booking, promo codes and sales totals.",
  icon: "/icon.svg",
  access: "everyone",
  resources: {
    d1: ["DB"],
    // Product files and lesson uploads, served only to their owner and paid buyers.
    r2: ["files"],
  },
  public: [
    // Store pages, product pages, checkout and buyers' access links: visitors have no account.
    { path: "/s/**", methods: ["GET", "POST"] },
    // The payment provider reports completed checkouts here; the request is signature-checked.
    { path: "/hooks/payments", methods: ["POST"] },
  ],
  publicAssets: ["/assets/**", "/icon.svg"],
  capabilities: {
    email: { access: "write", why: "Sends buyers their receipt and access link, and tells store owners about each sale." },
  },
  features: {
    payments: {
      name: "Card payments",
      why: "Buyers pay for priced products by card through your Stripe account.",
      steps: [
        "Copy your secret key: https://dashboard.stripe.com/apikeys",
        "Add a webhook endpoint at {appUrl}/hooks/payments for the event checkout.session.completed: https://dashboard.stripe.com/webhooks",
      ],
      secrets: [
        { name: "STRIPE_SECRET_KEY", how: "Stripe Dashboard → Developers → API keys → Secret key" },
        { name: "STRIPE_WEBHOOK_SECRET", how: "The webhook endpoint's Signing secret (whsec_…)" },
      ],
    },
    email: {
      name: "Email receipts",
      why: "Buyers get their access link by email and owners hear about each sale.",
      capabilities: ["email"],
    },
  },
});
