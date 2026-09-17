import { findRecentDuplicatePayment } from "../lib/hooks/fees";

const mockGetAll = jest.fn();
const mockMaybeSingle = jest.fn();

jest.mock("../lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                is: jest.fn(() => ({
                  limit: jest.fn(() => mockMaybeSingle()),
                })),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

jest.mock("../lib/offline", () => ({
  offlineDB: { getAll: (...args: unknown[]) => mockGetAll(...args) },
  useOnlineStatus: () => true,
}));

describe("findRecentDuplicatePayment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns matching recent row online", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: [{ id: "p1", amount_paid: 50000 }],
      error: null,
    });
    const res = await findRecentDuplicatePayment({
      schoolId: "s1",
      studentId: "st1",
      amount: 50000,
      method: "cash",
      online: true,
    });
    expect(res).toMatchObject({ id: "p1" });
  });

  test("returns null when amounts differ", async () => {
    mockMaybeSingle.mockResolvedValueOnce({
      data: [{ id: "p1", amount_paid: 40000 }],
      error: null,
    });
    const res = await findRecentDuplicatePayment({
      schoolId: "s1",
      studentId: "st1",
      amount: 50000,
      method: "cash",
      online: true,
    });
    expect(res).toBeNull();
  });

  test("checks local cache when offline", async () => {
    mockGetAll.mockResolvedValueOnce([
      {
        id: "off1",
        student_id: "st1",
        amount_paid: 50000,
        payment_method: "cash",
        created_at: new Date().toISOString(),
      },
    ]);
    const res = await findRecentDuplicatePayment({
      schoolId: "s1",
      studentId: "st1",
      amount: 50000,
      method: "cash",
      online: false,
    });
    expect(res).toMatchObject({ id: "off1" });
    expect(mockGetAll).toHaveBeenCalledWith("fee_payments", { student_id: "st1" });
  });

  test("fails open on guard errors", async () => {
    mockMaybeSingle.mockRejectedValueOnce(new Error("db down"));
    const res = await findRecentDuplicatePayment({
      schoolId: "s1",
      studentId: "st1",
      amount: 50000,
      method: "cash",
      online: true,
    });
    expect(res).toBeNull();
  });
});
