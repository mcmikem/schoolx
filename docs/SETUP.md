# ============================================
# OMUTO SCHOOL MANAGEMENT SYSTEM
# Production Setup Guide
# ============================================

This guide walks you through setting up Omuto SMS for production use.

---

## Prerequisites

1. Node.js 18+ installed
2. Supabase account (free tier works)
3. Africa's Talking account for SMS (optional)
4. Stripe/PayPal account (optional - for payments)

---

## Step 1: Supabase Setup

### 1.1 Create a New Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in:
   - Organization: Your company name
   - Name: `omuto-sms` (or any name)
   - Database Password: Create a strong password
   - Region: `EU (Frankfurt)` or closest to your users
4. Click "Create new project"
5. Wait 2-3 minutes for setup to complete

### 1.2 Run Database Schema

1. In Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Copy the contents of `supabase/schema.sql`
3. Paste into SQL Editor and click **Run**
4. Repeat for `supabase/seed.sql` (optional - adds demo data)

### 1.3 Get API Keys

1. Go to **Project Settings** → **API**
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Go to **Project Settings** → **Database** → **Connection Pooler**
4. Copy the URL (replace password with yours) → `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2: Environment Variables

### 2.1 Create .env.local

```bash
cp .env.example .env.local
```

### 2.2 Fill in the values

```env
# Required - Supabase (from Step 1.3)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional - SMS (Africa's Talking)
# Sign up at https://africastalking.com
AFRICAS_TALKING_API_KEY=your-api-key-from-dashboard
AFRICAS_TALKING_USERNAME=sandbox

# Optional - Payments (Stripe)
# Get keys from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Optional - PayPal
# Get credentials from https://developer.paypal.com
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your-client-id
PAYPAL_CLIENT_SECRET=your-secret
```

---

## Step 3: Verify Setup

### 3.1 Install dependencies
```bash
npm install
```

### 3.2 Run type check
```bash
npx tsc --noEmit
```

### 3.3 Run tests
```bash
npm test
```

### 3.4 Build the app
```bash
npm run build
```

All should pass without errors.

---

## Step 4: Start Development Server

```bash
npm run dev
```

Open http://localhost:3000

---

## Step 5: Production Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Go to https://vercel.com
3. Import your repository
4. Add environment variables in Vercel dashboard
5. Deploy

### Your Server

```bash
npm run build
npm start
```

Set `NODE_ENV=production`

---

## SMS Setup (Africa's Talking)

1. Sign up at https://africastalking.com
2. Go to **Dashboard** → **Settings** → **API Keys**
3. Copy your API key
4. In your app, go to Settings → SMS to configure

### Testing SMS
- Use the sandbox (test) mode
- Add test phone numbers in Africa's Talking dashboard

---

## Payment Setup (Optional)

### Stripe
1. Create account at https://stripe.com
2. Get API keys from Developers → API keys
3. Create products in Stripe Dashboard
4. Add price IDs to env

### PayPal
1. Create developer account at https://developer.paypal.com
2. Create sandbox app
3. Get Client ID and Secret

---

## Troubleshooting

### "Invalid API keys"
- Check your .env.local has correct Supabase URL format: `https://xxxxx.supabase.co`
- Ensure anon key starts with `eyJ`

### "Table not found"
- Run the SQL schema in Supabase SQL Editor
- Make sure you're using the correct database

### SMS not sending
- Verify Africa's Talking API key is correct
- Check you have sufficient SMS credits
- Use proper Uganda phone format (256...)

### Build fails
- Run `npm run build` locally first to see errors
- Check all environment variables are set

---

## Need Help?

- Email: support@omuto.org
- Documentation: Check the `/docs` folder
- Issues: Create a GitHub issue

---

© 2026 Omuto Technologies
