import {
  buildPhoneIndex,
  isSuccessfulStatus,
  matchStudentByPhone,
  parseMobileTransactions,
  validateMobileTransaction,
} from "@/lib/import/mobile-money";

describe("validateMobileTransaction", () => {
  it("reads an MTN MoMo style row", () => {
    const result = validateMobileTransaction({
      "Financial Transaction Id": "MP240101.1234.A56789",
      Amount: "500,000",
      "Payer MSISDN": "+256 772 123456",
      "Payer Name": "Nakato Grace",
      "Date and Time": "2026-03-15 09:12:00",
      "Transaction Status": "SUCCESSFUL",
      "Payer Message": "School fees term 1",
    });

    expect(result.isValid).toBe(true);
    expect(result.data).toMatchObject({
      reference: "MP240101.1234.A56789",
      amount: "500000",
      phone: "+256 772 123456",
      payer: "Nakato Grace",
      date: "2026-03-15",
      status: "SUCCESSFUL",
      purpose: "School fees term 1",
    });
  });

  it("reads an Airtel Money style row with different headings", () => {
    const result = validateMobileTransaction({
      "Transaction ID": "AIR20260315001",
      Value: "30000",
      MSISDN: "0700111222",
      "Sender Name": "Otieno Paul",
      Date: "15/03/2026",
      Status: "COMPLETED",
    });
    expect(result.isValid).toBe(true);
    expect(result.data).toMatchObject({ reference: "AIR20260315001", amount: "30000", date: "2026-03-15" });
  });

  it("rejects a line that is not a successful payment", () => {
    const result = validateMobileTransaction({
      "Transaction ID": "X1",
      Amount: "1000",
      MSISDN: "0700111222",
      Status: "FAILED",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/not a successful payment/i);
  });

  it("rejects a line with no payer phone", () => {
    const result = validateMobileTransaction({ "Transaction ID": "X1", Amount: "1000", Status: "SUCCESSFUL" });
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Payer phone is required");
  });
});

describe("isSuccessfulStatus", () => {
  it("treats blank and common success words as successful", () => {
    expect(isSuccessfulStatus("")).toBe(true);
    expect(isSuccessfulStatus("Successful")).toBe(true);
    expect(isSuccessfulStatus("1")).toBe(true);
    expect(isSuccessfulStatus("Reversed")).toBe(false);
  });
});

describe("phone matching", () => {
  const students = [
    { id: "s1", first_name: "Grace", last_name: "Nakato", parent_phone: "0772123456", parent_phone2: null },
    { id: "s2", first_name: "Paul", last_name: "Otieno", parent_phone: "0700111222", parent_phone2: "0750999888" },
  ];

  it("matches a statement number to a pupil in any written form", () => {
    const index = buildPhoneIndex(students);
    expect(matchStudentByPhone(index, "+256 772 123456")).toBe("s1");
    expect(matchStudentByPhone(index, "0772123456")).toBe("s1");
    expect(matchStudentByPhone(index, "256772123456")).toBe("s1");
    expect(matchStudentByPhone(index, "772123456")).toBe("s1");
  });

  it("matches against the second parent number too", () => {
    const index = buildPhoneIndex(students);
    expect(matchStudentByPhone(index, "0750999888")).toBe("s2");
  });

  it("returns undefined for a number no pupil has", () => {
    const index = buildPhoneIndex(students);
    expect(matchStudentByPhone(index, "0777000000")).toBeUndefined();
  });
});

describe("parseMobileTransactions", () => {
  it("maps a batch", () => {
    const rows = parseMobileTransactions([
      { "Transaction ID": "A", Amount: "1000", MSISDN: "0700111222", Status: "SUCCESSFUL" },
      { "Transaction ID": "B", Amount: "0", MSISDN: "0700111222", Status: "SUCCESSFUL" },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].isValid).toBe(true);
    expect(rows[1].isValid).toBe(false);
  });
});
