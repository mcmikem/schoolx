// Type declarations for Stripe SDK
declare module 'stripe' {
  // This is a placeholder - the actual types would be imported from the SDK
  export default class Stripe {
    constructor(key: string, options?: any);
    
    webhooks: {
      constructEvent(payload: string, sig: string, secret: any): any;
    };
    
    paymentIntents: {
      create(data: any): Promise<any>;
      confirm(id: string, data: any): Promise<any>;
    };
    
    subscriptions: {
      create(data: any): Promise<any>;
      update(id: string, data: any): Promise<any>;
      retrieve(id: string, expand?: any): Promise<any>;
    };
    
    customers: {
      create(data: any): Promise<any>;
      retrieve(id: string): Promise<any>;
    };
    
    billingPortal: {
      sessions: {
        create(data: any): Promise<{ url: string }>;
      };
    };
  }
}