export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const requiredVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRON_SECRET",
  ];

  for (const envVar of requiredVars) {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`);
    }
  }

  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasStripePublishable = !!process.env.STRIPE_PUBLISHABLE_KEY;
  const hasStripeWebhook = !!process.env.STRIPE_WEBHOOK_SECRET;
  const hasStripePrice = !!process.env.STRIPE_PRICE_STARTER;

  if (hasStripeSecret || hasStripePublishable || hasStripeWebhook || hasStripePrice) {
    const missing: string[] = [];
    if (!hasStripeSecret) missing.push("STRIPE_SECRET_KEY");
    if (!hasStripePublishable) missing.push("STRIPE_PUBLISHABLE_KEY");
    if (!hasStripeWebhook) missing.push("STRIPE_WEBHOOK_SECRET");
    if (!hasStripePrice) missing.push("STRIPE_PRICE_STARTER");
    if (missing.length > 0) {
      warnings.push(`Stripe partially configured. Missing: ${missing.join(", ")}`);
    }
  } else {
    warnings.push("Stripe not configured. Payment features requiring Stripe will be unavailable.");
  }

  const hasPayPalClientId = !!process.env.PAYPAL_CLIENT_ID;
  const hasPayPalClientSecret = !!process.env.PAYPAL_CLIENT_SECRET;
  const hasPayPalWebhook = !!process.env.PAYPAL_WEBHOOK_ID;

  if (hasPayPalClientId || hasPayPalClientSecret || hasPayPalWebhook) {
    const missing: string[] = [];
    if (!hasPayPalClientId) missing.push("PAYPAL_CLIENT_ID");
    if (!hasPayPalClientSecret) missing.push("PAYPAL_CLIENT_SECRET");
    if (!hasPayPalWebhook) missing.push("PAYPAL_WEBHOOK_ID");
    if (missing.length > 0) {
      warnings.push(`PayPal partially configured. Missing: ${missing.join(", ")}`);
    }
  } else {
    warnings.push("PayPal not configured. Payment features requiring PayPal will be unavailable.");
  }

  const hasAfricaTalkingApiKey = !!process.env.AFRICAS_TALKING_API_KEY;
  const hasAfricaTalkingUsername = !!process.env.AFRICAS_TALKING_USERNAME;

  if (hasAfricaTalkingApiKey || hasAfricaTalkingUsername) {
    const missing: string[] = [];
    if (!hasAfricaTalkingApiKey) missing.push("AFRICAS_TALKING_API_KEY");
    if (!hasAfricaTalkingUsername) missing.push("AFRICAS_TALKING_USERNAME");
    if (missing.length > 0) {
      warnings.push(`Africa's Talking partially configured. Missing: ${missing.join(", ")}`);
    }
    if (!process.env.SMS_DAILY_LIMIT) {
      warnings.push("SMS_DAILY_LIMIT not set. Using default of 500 messages per school per day.");
    }
    if (!process.env.AFRICAS_TALKING_DELIVERY_SECRET) {
      warnings.push("AFRICAS_TALKING_DELIVERY_SECRET not set. SMS delivery reports will accept unauthenticated requests.");
    }
  } else {
    warnings.push("Africa's Talking not configured. SMS features will be unavailable.");
  }

  const hasResendApiKey = !!process.env.RESEND_API_KEY;
  const hasEmailFrom = !!process.env.EMAIL_FROM;

  if (hasResendApiKey || hasEmailFrom) {
    const missing: string[] = [];
    if (!hasResendApiKey) missing.push("RESEND_API_KEY");
    if (!hasEmailFrom) missing.push("EMAIL_FROM");
    if (missing.length > 0) {
      warnings.push(`Resend partially configured. Missing: ${missing.join(", ")}`);
    }
  } else {
    warnings.push("Resend not configured. Email features will be unavailable.");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

export const isStripeConfigured =
  !!process.env.STRIPE_SECRET_KEY &&
  !!process.env.STRIPE_PUBLISHABLE_KEY &&
  !!process.env.STRIPE_WEBHOOK_SECRET &&
  !!process.env.STRIPE_PRICE_STARTER;

export const isPayPalConfigured =
  !!process.env.PAYPAL_CLIENT_ID &&
  !!process.env.PAYPAL_CLIENT_SECRET &&
  !!process.env.PAYPAL_WEBHOOK_ID;

export const isSmsConfigured =
  !!process.env.AFRICAS_TALKING_API_KEY &&
  !!process.env.AFRICAS_TALKING_USERNAME;

export const isEmailConfigured =
  !!process.env.RESEND_API_KEY &&
  !!process.env.EMAIL_FROM;
