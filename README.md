# Creator Storefront

Each member of your workspace gets a store page for selling 1:1 sessions, live courses, recorded courses and digital files. Buyers check out through a shareable link, book a time, and open what they bought from a private access link.

Inspired by https://app.nzmly.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Run your own store at `/s/<address>` with a name, headline, bio and currency.
- Sell four kinds of products, with drafts, publishing, per-country prices and uploaded files.
- Take free orders instantly and paid orders through your Stripe account, then cancel orders and see customers.
- Let buyers book open session times from your weekly hours, and cap seats on live courses.
- Give every buyer an access link with their files, lessons, session time and meeting link.
- Create promo codes with percent or fixed discounts, a product, a last day and a usage limit.
- Watch revenue, paid orders, store visits and recent sales over 24 hours to 12 months.

Left out: accounts and sign-in, which your Gateway handles; affiliate referrals; an integrations catalogue; payouts and platform fees; custom domains; page themes; session packages; video calls and calendar sync.

## Setup

```sh
pnpm install
pnpm dev                     # run locally
pnpm test                    # unit tests
pnpm run deploy              # deploy behind your Gateway
pnpm everyapp configure creator-storefront
```

The app opens with nothing to set. Two optional features:

- **Card payments**: `STRIPE_SECRET_KEY` (your Stripe secret key, used to start hosted checkouts) and `STRIPE_WEBHOOK_SECRET` (the signing secret of a webhook to `<app URL>/hooks/payments` for `checkout.session.completed`). Without them, priced products can't be bought.
- **Email receipts**: the Gateway's email capability. Buyers get their access link and owners a notice for each sale.

The checks in `checks/` run against a packaged release with `node /home/user/oss-new/control/runtime/try-release.mjs` in the oss.new sandbox. They don't cover a real Stripe checkout or real email delivery.

## Limitations

- All stores in one install share one Stripe account.
- Session hours and dates are in UTC.
- Prices assume currencies with two decimal places.
- Refunds are made in Stripe; cancelling an order here ends access but sends no money back.
- Uploads are limited to 100 MB per file.
