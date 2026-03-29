// Type declarations for PayPal SDK
declare module '@paypal/checkout-server-sdk' {
  // This is a placeholder - the actual types would be imported from the SDK
  export const environment: any;
  export const PayPalHttpClient: any;
  export namespace core {
    export class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    export class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
  }
  export namespace orders {
    export class OrdersCreateRequest {
      prefer(value: string): this;
      requestBody(body: any): this;
    }
    export class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: any): this;
    }
    export class OrdersGetRequest {
      constructor(orderId: string);
    }
  }
  export namespace billing {
    export class SubscriptionsCreateRequest {
      requestBody(body: any): this;
    }
    export class SubscriptionsActivateRequest {
      constructor(subscriptionId: string);
    }
    export class SubscriptionsGetRequest {
      constructor(subscriptionId: string);
    }
    export class SubscriptionsCancelRequest {
      constructor(subscriptionId: string);
      requestBody(body: any): this;
    }
    export class SubscriptionsReviseRequest {
      constructor(subscriptionId: string);
      requestBody(body: any): this;
    }
  }
  export namespace notifications {
    export class WebhookEvent {
      static verify(
        transmissionSig: string,
        certList: string[],
        authAlgo: string,
        transmissionId: string,
        transmissionTime: string,
        webhookId: string,
        webhookEvent: any
      ): boolean;
    }
  }
}