import { decryptProviderCredentials, encryptProviderCredentials } from "@/lib/payments/credential-vault";
import { AirtelMoneyClient } from "@/lib/payments/airtel-money";
import { MtnMomoClient } from "@/lib/payments/mobile-money";

const credentialKey = Buffer.alloc(32, 9).toString("base64");
const mockFetch = jest.fn();

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => "",
  } as Response;
}

describe("parent mobile money provider safety", () => {
  const originalFetch = global.fetch;
  const originalKey = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch as unknown as typeof fetch;
    process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = credentialKey;
  });

  afterAll(() => {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY = originalKey;
  });

  it("encrypts merchant credentials at rest and rejects tampering", () => {
    const secret = "private-merchant-token-do-not-return";
    const encrypted = encryptProviderCredentials({ clientSecret: secret, clientId: "merchant" });

    expect(encrypted).not.toContain(secret);
    expect(decryptProviderCredentials<{ clientSecret: string; clientId: string }>(encrypted)).toEqual({
      clientSecret: secret,
      clientId: "merchant",
    });

    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("a") ? "b" : "a"}`;
    expect(() => decryptProviderCredentials(tampered)).toThrow();
  });

  it("uses MTN Uganda's migrated production host and required target header", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ access_token: "access-token", expires_in: 3600 }))
      .mockResolvedValueOnce(mockResponse({}, 202));

    const client = new MtnMomoClient({
      subscriptionKey: "subscription-key",
      userId: "new-user-id",
      credentialToken: "new-credential-token",
      environment: "production",
    });
    await client.requestToPay({
      amount: 5000,
      phone: "256772123456",
      externalId: "intent-reference",
      referenceId: "intent-reference",
    });

    expect(mockFetch.mock.calls[0][0]).toBe("https://momoapi.momo.africa/collection/token/");
    expect(mockFetch.mock.calls[0][1].headers["X-Target-Environment"]).toBe("mtnuganda");
    expect(mockFetch.mock.calls[1][0]).toBe("https://momoapi.momo.africa/collection/v1_0/requesttopay");
    expect(mockFetch.mock.calls[1][1].headers["X-Reference-Id"]).toBe("intent-reference");
    expect(JSON.parse(mockFetch.mock.calls[1][1].body).externalId).toBe("intent-reference");
  });

  it("keeps an Airtel collection pending unless a final provider status is returned", async () => {
    mockFetch
      .mockResolvedValueOnce(mockResponse({ access_token: "airtel-token" }))
      .mockResolvedValueOnce(mockResponse({ data: { transaction: { id: "airtel-123" } } }, 200))
      .mockResolvedValueOnce(mockResponse({ data: { transaction: { id: "airtel-123", status: "TIP" } } }));

    const client = new AirtelMoneyClient({
      clientId: "airtel-client",
      clientSecret: "airtel-secret",
      environment: "production",
    });
    const initiated = await client.requestPayment({
      amount: 5000,
      phone: "256772123456",
      reference: "intent-reference",
      description: "Student wallet top-up",
    });
    const status = await client.getPaymentStatus(initiated.providerTransactionId);

    expect(initiated.providerTransactionId).toBe("airtel-123");
    expect(status.status).toBe("pending");
    expect(mockFetch.mock.calls[1][0]).toBe("https://openapi.airtel.africa/merchant/v1/payments/");
    expect(mockFetch.mock.calls[1][1].headers["X-Currency"]).toBe("UGX");
  });
});
