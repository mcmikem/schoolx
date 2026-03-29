import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Create a payment intent for subscription amount
export async function createPaymentIntent(
  amount: number, // amount in smallest currency unit (e.g., cents for USD)
  currency: string = 'usd',
  metadata: Record<string, string> = {}
) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      metadata,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw new Error('Failed to create payment intent');
  }
}

// Confirm a payment intent
export async function confirmPaymentIntent(
  paymentIntentId: string,
  paymentMethodId: string
) {
  try {
    const paymentIntent = await stripe.paymentIntents.confirm(paymentIntentId, {
      payment_method: paymentMethodId,
    });

    return paymentIntent;
  } catch (error) {
    console.error('Error confirming payment intent:', error);
    throw new Error('Failed to confirm payment intent');
  }
}

// Create a subscription
export async function createSubscription(
  customerId: string,
  priceId: string,
  metadata: Record<string, string> = {}
) {
  try {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      metadata,
      expand: ['latest_invoice.payment_intent'],
    });

    return subscription;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw new Error('Failed to create subscription');
  }
}

// Update a subscription
export async function updateSubscription(
  subscriptionId: string,
  priceId: string,
  prorationBehavior: Stripe.SubscriptionUpdateParams.ProrationBehavior = 'create_prorations'
) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: subscriptionId, price: priceId }],
      proration_behavior: prorationBehavior,
    });

    return subscription;
  } catch (error) {
    console.error('Error updating subscription:', error);
    throw new Error('Failed to update subscription');
  }
}

// Cancel a subscription
export async function cancelSubscription(
  subscriptionId: string,
  cancelAtPeriodEnd: boolean = true
) {
  try {
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: cancelAtPeriodEnd,
    });

    return subscription;
  } catch (error) {
    console.error('Error canceling subscription:', error);
    throw new Error('Failed to cancel subscription');
  }
}

// Create a customer portal session
export async function createCustomerPortalSession(
  customerId: string,
  returnUrl: string
) {
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return session.url;
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    throw new Error('Failed to create customer portal session');
  }
}

// Retrieve a subscription
export async function getSubscription(subscriptionId: string) {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['default_payment_method', 'latest_invoice.payment_intent'],
    });

    return subscription;
  } catch (error) {
    console.error('Error retrieving subscription:', error);
    throw new Error('Failed to retrieve subscription');
  }
}

// Create a customer
export async function createCustomer(
  email: string,
  name?: string,
  metadata: Record<string, string> = {}
) {
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata,
    });

    return customer;
  } catch (error) {
    console.error('Error creating customer:', error);
    throw new Error('Failed to create customer');
  }
}

// Retrieve a customer
export async function getCustomer(customerId: string) {
  try {
    const customer = await stripe.customers.retrieve(customerId);

    return customer;
  } catch (error) {
    console.error('Error retrieving customer:', error);
    throw new Error('Failed to retrieve customer');
  }
}

// Handle webhook events
export async function handleWebhookEvent(
  payload: Buffer,
  sig: string
) {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      payload,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error(`Webhook signature verification failed.`, err);
    throw new Error('Invalid webhook signature');
  }

  return event;
}

const stripeApi = {
  createPaymentIntent,
  confirmPaymentIntent,
  createSubscription,
  updateSubscription,
  cancelSubscription,
  createCustomerPortalSession,
  getSubscription,
  createCustomer,
  getCustomer,
  handleWebhookEvent,
}

export default stripeApi
