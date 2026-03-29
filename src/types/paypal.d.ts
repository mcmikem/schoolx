declare module '@paypal/checkout-server-sdk' {
  export interface Environment {
    clientId: string
    clientSecret: string
    baseUrl: string
  }

  export class SandboxEnvironment implements Environment {
    clientId: string
    clientSecret: string
    baseUrl: string
    constructor(clientId: string, clientSecret: string)
  }

  export class LiveEnvironment implements Environment {
    clientId: string
    clientSecret: string
    baseUrl: string
    constructor(clientId: string, clientSecret: string)
  }

  export class PayPalHttpClient {
    constructor(environment: Environment)
    execute(request: OrdersCreateRequest | OrdersCaptureRequest | OrdersGetRequest | SubscriptionsCreateRequest | SubscriptionsGetRequest | SubscriptionsActivateRequest | SubscriptionsCancelRequest | SubscriptionsReviseRequest): Promise<{ result: unknown }>
  }

  export namespace orders {
    class OrdersCreateRequest {
      prefer(returnPreference: string): OrdersCreateRequest
      requestBody(body: Record<string, unknown>): OrdersCreateRequest
    }

    class OrdersCaptureRequest {
      constructor(orderId: string)
      requestBody(body: Record<string, unknown>): OrdersCaptureRequest
    }

    class OrdersGetRequest {
      constructor(orderId: string)
    }
  }

  export namespace billing {
    class SubscriptionsCreateRequest {
      requestBody(body: Record<string, unknown>): SubscriptionsCreateRequest
    }

    class SubscriptionsGetRequest {
      constructor(subscriptionId: string)
    }

    class SubscriptionsActivateRequest {
      constructor(subscriptionId: string)
      requestBody(body: Record<string, unknown>): SubscriptionsActivateRequest
    }

    class SubscriptionsCancelRequest {
      constructor(subscriptionId: string)
      requestBody(body: Record<string, unknown>): SubscriptionsCancelRequest
    }

    class SubscriptionsReviseRequest {
      constructor(subscriptionId: string)
      requestBody(body: Record<string, unknown>): SubscriptionsReviseRequest
    }
  }

  export const orders: typeof orders
  export const billing: typeof billing
}
