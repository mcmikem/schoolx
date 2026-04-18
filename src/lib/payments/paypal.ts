import { logger } from "@/lib/logger";
const paypal: any = require('@paypal/checkout-server-sdk');

function getPayPalClientOrThrow() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("PayPal credentials are not configured");
  }

  const environment =
    process.env.PAYPAL_MODE === 'live'
      ? new paypal.core.LiveEnvironment(clientId, clientSecret)
      : new paypal.core.SandboxEnvironment(clientId, clientSecret);

  return new paypal.core.PayPalHttpClient(environment);
}

export const paypalClient = {
  execute(...args: any[]) {
    return getPayPalClientOrThrow().execute(...args);
  },
} as any;

export async function createPayPalOrder(
  amount: number,
  currency: string = 'USD',
  schoolId: string,
  returnUrl: string,
  cancelUrl: string
) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: (amount / 100).toFixed(2),
      },
      // We bind checkout orders to the tenant school so webhook reconciliation can
      // recover the correct payment record even when PayPal omits nested metadata.
      reference_id: schoolId,
      custom_id: schoolId,
    }],
    application_context: {
      brand_name: 'SkoolMate OS',
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  });

  try {
    const order = await paypalClient.execute(request);
    return order;
  } catch (error) {
    logger.error('Error creating PayPal order:', error);
    throw new Error('Failed to create PayPal order');
  }
}

export async function capturePayPalOrder(orderID: string) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await paypalClient.execute(request);
    return capture;
  } catch (error) {
    logger.error('Error capturing PayPal order:', error);
    throw new Error('Failed to capture PayPal order');
  }
}

export async function getPayPalOrder(orderID: string) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.orders.OrdersGetRequest(orderID);

  try {
    const order = await paypalClient.execute(request);
    return order;
  } catch (error) {
    logger.error('Error getting PayPal order:', error);
    throw new Error('Failed to get PayPal order');
  }
}

export async function createPayPalSubscription(
  planId: string,
  subscriber: {
    name: { given_name: string; surname: string };
    email_address: string;
    shipping_address: {
      address_line_1: string;
      admin_area_2: string;
      admin_area_1: string;
      postal_code: string;
      country_code: string;
    };
  },
  applicationContext: {
    brand_name: string;
    locale: string;
    shipping_preference: string;
    user_action: string;
    payment_method: {
      payer_selected: string;
      payee_preferred: string;
    };
  }
) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.billing.SubscriptionsCreateRequest();
   request.requestBody({
     plan_id: planId,
     subscriber,
     applicationContext,
   });

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    logger.error('Error creating PayPal subscription:', error);
    throw new Error('Failed to create PayPal subscription');
  }
}

export async function activatePayPalSubscription(subscriptionID: string) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.billing.SubscriptionsActivateRequest(subscriptionID);

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    logger.error('Error activating PayPal subscription:', error);
    throw new Error('Failed to activate PayPal subscription');
  }
}

export async function getPayPalSubscription(subscriptionID: string) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.billing.SubscriptionsGetRequest(subscriptionID);

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    logger.error('Error getting PayPal subscription:', error);
    throw new Error('Failed to get PayPal subscription');
  }
}

export async function cancelPayPalSubscription(subscriptionID: string, reason: string = 'Customer requested cancellation') {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.billing.SubscriptionsCancelRequest(subscriptionID);
  request.requestBody({
    reason,
  });

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    logger.error('Error canceling PayPal subscription:', error);
    throw new Error('Failed to cancel PayPal subscription');
  }
}

export async function revisePayPalSubscription(
  subscriptionID: string,
  planId: string,
  shippingAmount: { currency_code: string; value: string } = { currency_code: 'USD', value: '0' },
  taxAmount: { currency_code: string; value: string } = { currency_code: 'USD', value: '0' }
) {
  const paypalClient = getPayPalClientOrThrow();
  const request = new paypal.billing.SubscriptionsReviseRequest(subscriptionID);
  request.requestBody({
    plan_id: planId,
    shipping_amount: shippingAmount,
    tax_amount: taxAmount,
  });

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    logger.error('Error revising PayPal subscription:', error);
    throw new Error('Failed to revise PayPal subscription');
  }
}

export async function verifyPayPalWebhook(
  authAlgo: string,
  certUrl: string,
  transmissionId: string,
  transmissionSig: string,
  transmissionTime: string,
  webhookId: string,
  webhookEvent: any
): Promise<boolean> {
  try {
    const clientId = process.env.PAYPAL_CLIENT_ID;
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    const mode = process.env.PAYPAL_MODE === 'live' ? 'live' : 'sandbox';
    const baseUrl = mode === 'live' ? 'https://api.paypal.com' : 'https://api.sandbox.paypal.com';

    if (!clientId || !clientSecret || !webhookId) {
      if (process.env.NODE_ENV !== 'production') return true;
      return false;
    }

    // Step 1: Get OAuth token
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) return false;
    const tokenData = await tokenResponse.json();
    const accessToken: string = tokenData.access_token;

    // Step 2: Verify webhook signature
    const verifyResponse = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent,
      }),
    });

    if (!verifyResponse.ok) return false;
    const verifyData = await verifyResponse.json();
    return verifyData.verification_status === 'SUCCESS';
  } catch {
    return false;
  }
}

const paypalApi = {
  createPayPalOrder,
  capturePayPalOrder,
  getPayPalOrder,
  createPayPalSubscription,
  activatePayPalSubscription,
  getPayPalSubscription,
  cancelPayPalSubscription,
  revisePayPalSubscription,
  verifyPayPalWebhook,
  paypalClient,
}

export default paypalApi
