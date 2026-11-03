# SkoolMate OS

A Uganda-focused school operations platform. SkoolMate OS is the canonical product name; Omuto is the organization/domain name and `schoolx` is the repository package name.

## Features

### Core Modules
- **Student Management** - Registration, transfers, dropout tracking
- **Attendance** - Daily, period-based, dorm attendance
- **Grades & Exams** - CA tracking, UNEB support, report cards
- **Fee Management** - Structure, payments, invoices, payment plans
- **Staff Management** - Directory, attendance, leave, payroll
- **Communication** - SMS, bulk messaging, notices

### Specialized Features
- **UNEB Support** - PLE, UCE, UACE registration and reporting
- **Parent Portal** - Student progress, fees, homework, and notices; notification refresh is polled, not live-pushed
- **Offline Mode** - IndexedDB caching and queued writes for selected workflows; billing, payments, bulk SMS, imports, AI, UNEB submissions, and some reports require connectivity
- **Mobile Money** - MTN & Airtel Uganda payments
- **Auto-SMS** - Scheduled fee reminders and absentee alerts when a provider, valid contacts, and an eligible plan are configured

## Tech Stack

- **Frontend**: Next.js 16, React 18, TypeScript
- **Styling**: Tailwind CSS 3.4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe and PayPal subscriptions; MoneyUnify or direct MTN MoMo/Airtel mobile-money flows when configured
- **SMS**: Africa's Talking
- **Offline**: IndexedDB (idb)

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- Africa's Talking account (SMS)
- Stripe/PayPal account (payments)

### Installation

```bash
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

### Demo mode

Demo login is development-only. Set `ENABLE_DEV_TEST_ROUTES=true`,
`NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true`, and a local `DEMO_ADMIN_PASSWORD`,
then use the demo page. Production deployments must keep these flags disabled.

## Environment Variables

Public client variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Server-only variables:

```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret

STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_STARTER=price_xxx
STRIPE_PRICE_GROWTH=price_xxx
STRIPE_PRICE_ENTERPRISE=price_xxx
STRIPE_PRICE_LIFETIME=price_xxx

PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
PAYPAL_WEBHOOK_ID=your_webhook_id

AFRICAS_TALKING_API_KEY=your_api_key
AFRICAS_TALKING_USERNAME=your_username
SMS_API_KEY=your_sms_api_key
SMS_USERNAME=your_sms_username

RESEND_API_KEY=re_xxx
EMAIL_FROM=noreply@yourdomain.com

FLUTTERWAVE_PUBLIC_KEY=FLWPUBK-xxx
FLUTTERWAVE_SECRET_KEY=FLWSECK-xxx
FLUTTERWAVE_WEBHOOK_SECRET=your_flutterwave_webhook_secret

GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://username:password@host:port
```

Non-production only:

```env
ENABLE_DEV_TEST_ROUTES=true
NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES=true
DEMO_ADMIN_PASSWORD=skoolmate_demo_2024
```

## Deployment Notes

- Add public env vars to both Vercel and GitHub Actions when CI builds the app.
- Add all server-only env vars to Vercel before enabling payments, cron jobs, storage setup, imports, or SMS automation.
- Keep `ENABLE_DEV_TEST_ROUTES` and `NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES` set to `false` in production.
- Set `CRON_SECRET` in Vercel or scheduled automation routes will return 500.

## Testing and release gates

```bash
npm run lint
npm run typecheck
npm test
npm run test:regression
npm run check:schema-drift
npm run check:production-leakage
npm run scan:secrets
npm run build

Use `npm run test:auth`, `npm run test:e2e`, and `npm run test:e2e:offline`
when changing authentication, routes, or offline behavior. Use
`npm run check:release` before a release and `npm run smoke:prod` after deploy.
```

## Project Structure

```
src/
├── app/               # Next.js App Router pages
│   ├── api/           # API routes
│   ├── dashboard/      # Main app pages
│   ├── login/         # Auth pages
│   └── parent/        # Parent portal
├── components/        # Reusable React components
│   ├── ui/           # Base UI components
│   └── fees/         # Fee module components
└── lib/              # Utilities and hooks
    ├── hooks.ts      # Data fetching hooks
    ├── auth-context.tsx  # Auth provider
    ├── businessRules.ts  # Validation logic
    ├── grading.ts    # UNEB grading
    ├── subscription.ts   # Plan management
    └── payments/     # Payment integrations
```

## Subscription plans

The billing configuration is authoritative. Plan identifiers are
`free_trial`, `starter`, `growth`, `enterprise`, and `lifetime`. Limits and
entitlements can change; use `src/lib/billing/config.ts` and the pricing page
as the source of truth.

Do not infer offline, UNEB, parent-portal, or SMS availability from old plan
names. Check the canonical billing configuration before publishing pricing or
changing an entitlement.

## Security

- Row Level Security (RLS) is used in Supabase; test policies against
  cross-school and multi-role access.
- Some API routes enforce rate limiting and CSRF checks; this is not a claim of
  complete security coverage.
- Student photos are private storage objects and must be accessed through
  authenticated, school-scoped signed URLs.
- Offline data can remain on a shared device until storage is cleared; browser
  storage is not a secure vault.
- Demo mode is session-scoped and must never connect to production data.

See [the production operations runbook](docs/OPERATIONS_RUNBOOK.md) for
migrations, release gates, backups, incident response, and provider outages.
- Production deployments must provide valid Supabase env vars; silent mock fallback is disabled

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, contact support@omuto.org
