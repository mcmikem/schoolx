import { normalizePhone, telHref, whatsappHref } from "@/lib/phone-links";

describe("normalizePhone", () => {
  it.each([
    ["0772123456", "256772123456"],
    ["0772 123 456", "256772123456"],
    ["+256772123456", "256772123456"],
    ["256-772-123456", "256772123456"],
    ["00256772123456", "256772123456"],
    ["772123456", "256772123456"],
  ])("normalises %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it("returns null for empty or too-short input", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
  });
});

describe("link builders", () => {
  it("builds a tel link", () => {
    expect(telHref("0772 123 456")).toBe("tel:+256772123456");
    expect(telHref("")).toBeNull();
  });

  it("builds a WhatsApp link with an optional message", () => {
    expect(whatsappHref("0772123456")).toBe("https://wa.me/256772123456");
    expect(whatsappHref("0772123456", "Hello Amina, ")).toBe("https://wa.me/256772123456?text=Hello%20Amina%2C%20");
  });
});
