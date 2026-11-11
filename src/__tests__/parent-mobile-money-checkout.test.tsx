import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ParentMobileMoneyCheckout from "@/components/parent-portal/ParentMobileMoneyCheckout";

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

jest.mock("@/components/Toast", () => ({ useToast: () => mockToast }));
jest.mock("@/lib/offline", () => ({ useOnlineStatus: () => true }));

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => data });
}

const child = { id: "student-1", first_name: "Amina" };

describe("parent mobile-money checkout", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it("credits the parent view only after the server reports provider confirmation", async () => {
    const onPaymentConfirmed = jest.fn();
    global.fetch = jest.fn((input, init) => {
      const url = String(input);
      if (init?.method === "POST") {
        return jsonResponse({
          success: true,
          data: {
            payment: {
              id: "payment-1",
              purpose: "wallet_topup",
              provider: "mtn",
              amount: 5000,
              currency: "UGX",
              phoneLast4: "3456",
              status: "pending",
            },
          },
        }) as never;
      }
      if (url.includes("paymentId=")) {
        return jsonResponse({
          success: true,
          data: {
            payment: {
              id: "payment-1",
              purpose: "wallet_topup",
              provider: "mtn",
              amount: 5000,
              currency: "UGX",
              phoneLast4: "3456",
              status: "completed",
            },
          },
        }) as never;
      }
      return jsonResponse({
        success: true,
        data: { payment: null, providers: { mtn: true, airtel: false } },
      }) as never;
    }) as typeof fetch;

    render(
      <ParentMobileMoneyCheckout
        isOpen
        onClose={jest.fn()}
        child={child}
        purpose="wallet_topup"
        defaultAmount="5000"
        onPaymentConfirmed={onPaymentConfirmed}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /request secure phone prompt/i })).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText("0772 123 456"), { target: { value: "0772 123 456" } });
    fireEvent.click(screen.getByRole("button", { name: /request secure phone prompt/i }));

    await waitFor(() => expect(screen.getByText("Payment confirmed")).toBeInTheDocument());
    expect(onPaymentConfirmed).toHaveBeenCalledTimes(1);
    expect(onPaymentConfirmed).toHaveBeenCalledWith(5000);
  });

  it("does not update balances when the provider reports failure", async () => {
    const onPaymentConfirmed = jest.fn();
    global.fetch = jest.fn((input, init) => {
      const url = String(input);
      if (init?.method === "POST") {
        return jsonResponse({
          success: true,
          data: {
            payment: {
              id: "payment-2",
              purpose: "fee_payment",
              provider: "mtn",
              amount: 5000,
              currency: "UGX",
              phoneLast4: "3456",
              status: "failed",
            },
          },
        }) as never;
      }
      return jsonResponse({ success: true, data: { payment: null, providers: { mtn: true, airtel: false } } }) as never;
    }) as typeof fetch;

    render(
      <ParentMobileMoneyCheckout
        isOpen
        onClose={jest.fn()}
        child={child}
        purpose="fee_payment"
        defaultAmount="5000"
        onPaymentConfirmed={onPaymentConfirmed}
      />,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: /request secure phone prompt/i })).toBeEnabled());
    fireEvent.change(screen.getByPlaceholderText("0772 123 456"), { target: { value: "0772 123 456" } });
    fireEvent.click(screen.getByRole("button", { name: /request secure phone prompt/i }));

    await waitFor(() => expect(screen.getByText("Payment not completed")).toBeInTheDocument());
    expect(onPaymentConfirmed).not.toHaveBeenCalled();
  });
});
