import {
  getOmutoAuthEmailCandidates,
  isValidUgandaPhone,
  parseUgandaPhone,
} from "../lib/auth-phone";

describe("auth-phone", () => {
  test("normalizes local and international Uganda formats to one canonical number", () => {
    expect(parseUgandaPhone("0700000000")?.canonical).toBe("0700000000");
    expect(parseUgandaPhone("+256700000000")?.canonical).toBe("0700000000");
    expect(parseUgandaPhone("700000000")?.canonical).toBe("0700000000");
  });

  test("returns auth email candidates for both canonical and legacy international formats", () => {
    expect(getOmutoAuthEmailCandidates("+256700000000")).toEqual([
      "0700000000@omuto.org",
      "256700000000@omuto.org",
    ]);
  });

  test("rejects invalid phone values", () => {
    expect(isValidUgandaPhone("12345")).toBe(false);
    expect(getOmutoAuthEmailCandidates("12345")).toEqual([]);
  });
});

