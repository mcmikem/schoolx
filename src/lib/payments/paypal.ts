const paypal: any = require('@paypal/checkout-server-sdk');

let environment: any;

if (process.env.PAYPAL_MODE === 'live') {
  environment = new paypal.core.LiveEnvironment(
    process.env.PAYPAL_CLIENT_ID!,
    process.env.PAYPAL_CLIENT_SECRET!
  );
} else {
  environment = new paypal.core.SandboxEnvironment(
    process.env.PAYPAL_CLIENT_ID!,
    process.env.PAYPAL_CLIENT_SECRET!
  );
}

export const paypalClient = new paypal.core.PayPalHttpClient(environment);

export async function createPayPalOrder(
  amount: number,
  currency: string = 'USD',
  subscriptionId: string,
  returnUrl: string,
  cancelUrl: string
) {
  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: {
        currency_code: currency,
        value: (amount / 100).toFixed(2),
      },
      reference_id: subscriptionId,
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
    console.error('Error creating PayPal order:', error);
    throw new Error('Failed to create PayPal order');
  }
}

export async function capturePayPalOrder(orderID: string) {
  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await paypalClient.execute(request);
    return capture;
  } catch (error) {
    console.error('Error capturing PayPal order:', error);
    throw new Error('Failed to capture PayPal order');
  }
}

export async function getPayPalOrder(orderID: string) {
  const request = new paypal.orders.OrdersGetRequest(orderID);

  try {
    const order = await paypalClient.execute(request);
    return order;
  } catch (error) {
    console.error('Error getting PayPal order:', error);
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
    console.error('Error creating PayPal subscription:', error);
    throw new Error('Failed to create PayPal subscription');
  }
}

export async function activatePayPalSubscription(subscriptionID: string) {
  const request = new paypal.billing.SubscriptionsActivateRequest(subscriptionID);

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    console.error('Error activating PayPal subscription:', error);
    throw new Error('Failed to activate PayPal subscription');
  }
}

export async function getPayPalSubscription(subscriptionID: string) {
  const request = new paypal.billing.SubscriptionsGetRequest(subscriptionID);

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    console.error('Error getting PayPal subscription:', error);
    throw new Error('Failed to get PayPal subscription');
  }
}

export async function cancelPayPalSubscription(subscriptionID: string, reason: string = 'Customer requested cancellation') {
  const request = new paypal.billing.SubscriptionsCancelRequest(subscriptionID);
  request.requestBody({
    reason,
  });

  try {
    const subscription = await paypalClient.execute(request);
    return subscription;
  } catch (error) {
    console.error('Error canceling PayPal subscription:', error);
    throw new Error('Failed to cancel PayPal subscription');
  }
}

export async function revisePayPalSubscription(
  subscriptionID: string,
  planId: string,
  shippingAmount: { currency_code: string; value: string } = { currency_code: 'USD', value: '0' },
  taxAmount: { currency_code: string; value: string } = { currency_code: 'USD', value: '0' }
) {
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
    console.error('Error revising PayPal subscription:', error);
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
) {
  if (
    !authAlgo ||
    !certUrl ||
    !transmissionId ||
    !transmissionSig ||
    !transmissionTime ||
    !webhookId ||
    !webhookEvent
  ) {
    return false;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return false;

  const baseUrl =
    process.env.PAYPAL_MODE === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!tokenResponse.ok) {
      return false;
    }

    const tokenJson = await tokenResponse.json();
    const accessToken = tokenJson?.access_token;
    if (!accessToken) return false;

    const verifyResponse = await fetch(
      `${baseUrl}/v1/notifications/verify-webhook-signature`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
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
      }
    );

    if (!verifyResponse.ok) {
      return false;
    }

    const verifyJson = await verifyResponse.json();
    return verifyJson?.verification_status === "SUCCESS";
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
