# Deploying the Audacity site

The site runs on Cloudflare Pages. Static pages live in `public/`, server code in `functions/`, and the database schema in `migrations/`.

## One-time setup

1. **Cloudflare account.** Add `theaudacity.in` to Cloudflare (or point its DNS to Cloudflare).
2. **Database.** Run `npx wrangler d1 create audacity`, then paste the `database_id` it prints into `wrangler.toml`. Run `npm run db:migrate:remote`.
3. **File storage.** Run `npx wrangler r2 bucket create audacity-files`. (R2 asks for a card on file, even on the free tier.) Keep the bucket private.
4. **Pages project.** In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect to Git → this repo. Build command: `npm install`. Build output directory: `public`. Under Settings → Bindings, check that the D1 binding `DB` and the R2 binding `FILES` are there (they come from `wrangler.toml`).
5. **Custom domain.** Pages project → Custom domains → add `theaudacity.in`. GitHub Pages is no longer used, so turn it off in the GitHub repo settings.
6. **Environment variables** (Pages project → Settings → Variables and secrets, as secrets):

| Name | What it is |
|---|---|
| `RAZORPAY_KEY_ID` | Razorpay key ID (test key first, then live) |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | The secret you set on the Razorpay webhook |
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | e.g. `Audacity <hello@theaudacity.in>` (the domain must be verified in Resend) |
| `FOUNDERS_EMAIL` | Where order and confession notifications go |
| `ANTHROPIC_API_KEY` | For the friend-letter writing helper |
| `UPI_ID` | UPI ID shown in the QR fallback |
| `UPI_PAYEE_NAME` | Payee name in the QR, e.g. `Audacity` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Login for `/admin` |

7. **Resend.** Add and verify `theaudacity.in` as a sending domain.
8. **Razorpay webhook.** Dashboard → Webhooks → add `https://theaudacity.in/api/razorpay-webhook` for the `payment.captured` event, with the same secret as `RAZORPAY_WEBHOOK_SECRET`. The webhook is what marks orders paid and sends the emails.

## Before launch

Fill in the placeholders `[date]`, `[City]`, `[email]`, `[phone]` and `[business address]` in `public/terms.html`, `privacy.html`, `refunds.html`, `shipping.html` and `contact.html`.

## Running it locally

```
npm install
cp .dev.vars.example .dev.vars   # fill in test keys
npm run db:migrate:local
npm run dev                      # http://localhost:8788
```

## Day to day

- `/admin` lists orders and confessions, with file downloads and a CSV export.
- UPI QR orders arrive as `pending_verification`. Check the UTR against the bank statement, then set the order to `paid`.
- When you post a service letter, set it to `dispatched` with the India Post tracking number. That emails the number to the buyer.
