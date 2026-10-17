import { act, renderHook } from "@testing-library/react";
import { useFeePayments } from "@/lib/hooks/fees";
import { getLocalDateString } from "@/lib/hooks/utils";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    isDemo: true,
    school: { id: "demo-school" },
    user: { id: "demo-bursar" },
  }),
}));
jest.mock("@/lib/offline", () => ({
  useOnlineStatus: () => true,
  offlineDB: {},
}));

describe("payment received dates", () => {
  it("preserves a historical date instead of replacing it with today's date", async () => {
    const { result } = renderHook(() => useFeePayments("demo-school"));
    await act(async () => {
      const saved = await result.current.createPayment({
        student_id: "student-1",
        amount_paid: 50000,
        fee_id: "fee-1",
        payment_method: "cash",
        payment_date: "2026-02-05",
      });
      expect(saved.payment_date).toBe("2026-02-05");
    });
  });

  it("defaults omitted dates to the local calendar day", async () => {
    const { result } = renderHook(() => useFeePayments("demo-school"));
    await act(async () => {
      const saved = await result.current.createPayment({
        student_id: "student-1",
        amount_paid: 50000,
        fee_id: "fee-1",
        payment_method: "cash",
      });
      expect(saved.payment_date).toBe(getLocalDateString());
    });
  });
});
