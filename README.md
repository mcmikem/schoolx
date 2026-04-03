# Omuto School Management System

A comprehensive, offline-first school management platform designed for East African schools with a focus on Uganda's education system.

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
- **Parent Portal** - Real-time student progress viewing
- **Offline Mode** - IndexedDB for areas with poor connectivity
- **Mobile Money** - MTN & Airtel Uganda payments
- **Auto-SMS** - Automated fee reminders and absentee alerts

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS 3.4
- **Backend**: Supabase (PostgreSQL + Auth)
- **Payments**: Stripe, PayPal, Flutterwave (Mobile Money)
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

### Demo Credentials
- Phone: `0700000001`
- Password: `demo1234`

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_secret
AFRICAS_TALKING_API_KEY=your_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Testing

```bash
npm test        # Run tests
npm run lint    # Check lint
npm run build   # Production build
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

## Subscription Plans

| Feature | Free Trial | Basic | Premium | Max |
|---------|------------|-------|---------|-----|
| Students | 100 | 300 | 1,000 | Unlimited |
| SMS/Month | 20 | 100 | 500 | 2,000 |
| UNEB Export | ❌ | ✅ | ✅ | ✅ |
| Parent Portal | ❌ | ❌ | ✅ | ✅ |
| Offline Mode | ❌ | ❌ | ❌ | ✅ |
| Multi-School | ❌ | ❌ | ❌ | ✅ |

## Security

- Row Level Security (RLS) enabled
- Input sanitization on all API routes
- Rate limiting on sensitive endpoints
- CSRF protection on mutations
- Encrypted demo mode storage

## License

Proprietary - All rights reserved

## Support

For issues and feature requests, contact support@omuto.org
