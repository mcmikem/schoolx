import { errorToMessage, explainError } from "@/lib/owly-errors";

describe("owly error explanations", () => {
  it("explains a dropped connection without blaming the user", () => {
    const explanation = explainError("Failed to fetch");
    expect(explanation.title).toMatch(/did not reach the server/i);
    expect(explanation.steps.join(" ")).toMatch(/Sync Center/);
  });

  it("recognises permission failures", () => {
    expect(explainError("new row violates row-level security policy").title).toMatch(/not allowed/i);
    expect(explainError("403 Forbidden").title).toMatch(/not allowed/i);
  });

  it("recognises duplicates and validation errors", () => {
    expect(explainError("duplicate key value violates unique constraint").title).toMatch(/already exists/i);
    expect(explainError("phone is required").title).toMatch(/missing or wrong/i);
  });

  it("keeps the original message so support can still see it", () => {
    const message = errorToMessage("Failed to fetch");
    expect(message).toContain("The exact message");
    expect(message).toContain("Failed to fetch");
  });

  it("falls back to a plain next step for anything unrecognised", () => {
    const explanation = explainError("something odd happened");
    expect(explanation.steps.length).toBeGreaterThan(0);
    expect(explanation.summary.length).toBeGreaterThan(0);
  });
});
