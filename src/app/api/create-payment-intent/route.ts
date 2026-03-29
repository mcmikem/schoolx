import { NextResponse } from 'next/server';
import { stripe } from '../../../lib/payments/stripe';
import { createSupabaseServerClient } from '../../../lib/supabase/server';

export async function POST(request: Request) {
  try {
    const { amount, currency, plan, schoolId } = await request.json() as {
      amount: number;
      currency: string;
      plan: string;
      schoolId: string;
    };
    
    if (!amount || !currency || !plan || !schoolId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    
    // Verify the school exists and get/create Stripe customer
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, stripe_customer_id')
      .eq('id', schoolId)
      .single();

    if (schoolError || !school) {
      return NextResponse.json(
        { error: 'School not found' },
        { status: 404 }
      );
    }

    let customerId = school.stripe_customer_id;

    // If no Stripe customer exists, create one
    if (!customerId) {
      // In a real implementation, we would get the email from the school or user
      const customer = await stripe.customers.create({
        email: 'school@example.com', // This should come from the school data
        metadata: {
          school_id: schoolId,
        },
      });
      
      customerId = customer.id;
      
      // Update the school with the Stripe customer ID
      await supabase
        .from('schools')
        .update({ stripe_customer_id: customerId })
        .eq('id', schoolId);
    }

    // Create a payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      metadata: {
        plan,
        school_id: schoolId,
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}