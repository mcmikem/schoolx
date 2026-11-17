import {
  baseSmsVars,
  hasSmsTokens,
  renderSmsTemplate,
  unresolvedSmsTokens,
} from "@/lib/sms-template";

describe("sms-template", () => {
  const now = new Date("2026-11-17T10:00:00Z");
  const base = baseSmsVars("SkoolMate Primary", now);

  it("fills single-brace tokens used by the SMS Centre", () => {
    expect(renderSmsTemplate("Dear parent, {student_name} owes {amount}.", { student_name: "Amina" })).toBe(
      "Dear parent, Amina owes {amount}.",
    );
  });

  it("fills double-brace tokens used by the Messages templates", () => {
    const rendered = renderSmsTemplate("Hello {{student_name}}, see you on {{date}}.", {
      ...base,
      student_name: "Okello",
    });
    expect(rendered).toBe(`Hello Okello, see you on ${base.date}.`);
    expect(rendered).not.toContain("{{");
  });

  it("leaves tokens with no value untouched rather than blanking them", () => {
    expect(renderSmsTemplate("Balance: {amount}", base)).toBe("Balance: {amount}");
  });

  it("treats empty strings as missing so a blank pupil name is not sent", () => {
    expect(renderSmsTemplate("Hi {student_name}", { student_name: "   " })).toBe("Hi {student_name}");
  });

  it("does not partially consume a double-brace token", () => {
    expect(renderSmsTemplate("{{student_name}}", {})).toBe("{{student_name}}");
  });

  it("reports which tokens are still unresolved", () => {
    const body = "{student_name} and {date} and {student_name}";
    expect(unresolvedSmsTokens(body, base)).toEqual(["student_name"]);
    expect(unresolvedSmsTokens(body, { ...base, student_name: "Amina" })).toEqual([]);
  });

  it("detects tokens without mutating a shared regex", () => {
    expect(hasSmsTokens("no tokens here")).toBe(false);
    expect(hasSmsTokens("hi {student_name}")).toBe(true);
    expect(hasSmsTokens("hi {student_name}")).toBe(true);
  });

  it("always provides school_name and date", () => {
    expect(base.school_name).toBe("SkoolMate Primary");
    expect(base.date).toBeTruthy();
    expect(baseSmsVars(null, now).school_name).toBe("the school");
  });
});
