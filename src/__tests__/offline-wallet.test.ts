import { describe, expect, it } from "@jest/globals";
import { findCachedPOSStudent, reconcileCachedWalletRows } from "@/lib/offline-wallet";

describe("offline canteen wallet data", () => {
  const students = [
    {
      id: "student-a",
      school_id: "school-a",
      first_name: "Amina",
      last_name: "Nabirye",
      student_number: "P001",
    },
    {
      id: "student-b",
      school_id: "school-b",
      first_name: "Brian",
      last_name: "Okello",
      student_number: "P002",
    },
  ];
  const wallets = [
    { id: "wallet-a", school_id: "school-a", student_id: "student-a", balance: "25000" },
    { id: "wallet-b", school_id: "school-b", student_id: "student-b", balance: "99000" },
  ];

  it("looks up only this school's saved student and wallet", () => {
    expect(findCachedPOSStudent(students, wallets, "school-a", "p001")).toMatchObject({
      id: "student-a",
      first_name: "Amina",
      balance: 25000,
      walletAvailable: true,
    });
    expect(findCachedPOSStudent(students, wallets, "school-a", "student-b")).toBeNull();
  });

  it("does not claim a wallet was downloaded when it is missing", () => {
    expect(findCachedPOSStudent(students, [], "school-a", "P001")).toMatchObject({
      id: "student-a",
      balance: 0,
      walletAvailable: false,
    });
  });

  it("keeps pending offline purchases deducted after a server refresh", () => {
    const refreshed = [{ id: "wallet-a", school_id: "school-a", student_id: "student-a", balance: 25000 }];
    const queued = [
      {
        table: "canteen_sales",
        synced: false,
        data: { pending_wallet_deduction: { student_id: "student-a", amount: 8000 } },
      },
      {
        table: "canteen_sales",
        status: "failed",
        synced: false,
        data: { pending_wallet_deduction: { student_id: "student-a", amount: 3000 } },
      },
      {
        table: "canteen_sales",
        synced: true,
        data: { pending_wallet_deduction: { student_id: "student-a", amount: 1000 } },
      },
      {
        table: "attendance",
        synced: false,
        data: { pending_wallet_deduction: { student_id: "student-a", amount: 5000 } },
      },
    ];

    expect(reconcileCachedWalletRows(refreshed, queued)[0].balance).toBe(14000);
  });

  it("never presents a negative cached wallet balance", () => {
    const refreshed = [{ id: "wallet-a", school_id: "school-a", student_id: "student-a", balance: 500 }];
    const queued = [
      {
        table: "canteen_sales",
        synced: false,
        data: { pending_wallet_deduction: { student_id: "student-a", amount: 700 } },
      },
    ];
    expect(reconcileCachedWalletRows(refreshed, queued)[0].balance).toBe(0);
  });
});
