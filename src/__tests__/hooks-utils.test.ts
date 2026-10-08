import { isMissingTableColumnError } from "../lib/hooks/utils";

// Staff edits died in production with "Could not find the 'subject' column of
// 'users' in the schema cache" while the fallback next to the call only
// recognised Postgres 42703. PostgREST rejects unknown columns itself as
// PGRST204 before Postgres is ever reached, so both shapes must count.

describe("isMissingTableColumnError", () => {
  it("recognises the PostgREST schema-cache rejection", () => {
    expect(
      isMissingTableColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'subject' column of 'users' in the schema cache",
        },
        "users",
        "subject",
      ),
    ).toBe(true);
  });

  it("recognises the Postgres undefined-column error", () => {
    expect(
      isMissingTableColumnError(
        { code: "42703", message: 'column users."subject" does not exist' },
        "users",
        "subject",
      ),
    ).toBe(true);
  });

  it("does not match other tables, columns, or failures", () => {
    expect(
      isMissingTableColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'subject' column of 'users' in the schema cache",
        },
        "users",
        "email",
      ),
    ).toBe(false);
    expect(
      isMissingTableColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'subject' column of 'students' in the schema cache",
        },
        "users",
        "subject",
      ),
    ).toBe(false);
    expect(isMissingTableColumnError({ code: "23505", message: "duplicate key" }, "users", "subject")).toBe(false);
    expect(isMissingTableColumnError(null, "users", "subject")).toBe(false);
  });
});
