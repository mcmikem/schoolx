import { NextResponse } from 'next/server';
import { stripe } from '@/lib/payments/stripe';
import { createSupabaseServerClient } from '@/lib/supabase/server';

// Create Stripe customer portal session
export async function POST(request: Request) {
  try {
    const { customerId, returnUrl } = await request.json();
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    
    // Verify the customer belongs to the current user's school
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, stripe_customer_id')
      .eq('stripe_customer_id', customerId)
      .single();

    if (error || !school) {
      return NextResponse.json(
        { error: 'Invalid customer ID' },
        { status: 403 }
      );
    }

    // Create the portal session
    const portalUrl = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
    });

    return NextResponse.json({ url: portalUrl.url });
  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json(
      { error: 'Failed to create customer portal session' },
      { status: 500 }
    );
  }
}