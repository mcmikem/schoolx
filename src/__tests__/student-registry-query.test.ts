/** @jest-environment node */
import { registryQuery, searchWords } from "@/lib/students/registry-query";

jest.mock("@/lib/supabase", () => {
  const { createClient } = require("@supabase/supabase-js");
  const fetchPage = jest.fn(
    async () => new Response("[]", { headers: { "Content-Type": "application/json", "Content-Range": "*/120" } }),
  );
  return {
    supabase: createClient("https://example.supabase.co", "test-anon-key", {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: fetchPage },
    }),
    fetchPage,
  };
});

describe("server-paged student register", () => {
  const requests = () => (jest.requireMock("@/lib/supabase") as { fetchPage: jest.Mock }).fetchPage;
  beforeEach(() => requests().mockClear());
  it("requests just the second page and keeps filtering and counts on the server", async () => {
    const result = await registryQuery("school-a", "id,first_name,last_name,classes(name)", {
      search: "Amina Nakato",
      classId: "class-a",
      gender: "F",
      sortBy: "name",
    }).range(50, 99);
    expect(result.count).toBe(120);
    const url = new URL(String(requests().mock.calls[0][0]));
    expect(url.searchParams.get("offset")).toBe("50");
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("school_id")).toBe("eq.school-a");
    expect(url.searchParams.get("class_id")).toBe("eq.class-a");
    expect(url.searchParams.get("gender")).toBe("eq.F");
    expect(url.searchParams.getAll("or")).toHaveLength(2);
    expect(url.searchParams.get("order")).toBe("first_name.asc,last_name.asc,id.asc");
  });
  it("sends the same filters for the head count without downloading rows", async () => {
    await registryQuery(
      "school-a",
      "id",
      { search: "Nakato", status: "active", position: "monitor", defaultersOnly: true },
      true,
    );
    const [input, options] = requests().mock.calls[0];
    const url = new URL(String(input));
    expect(options.method).toBe("HEAD");
    expect(url.searchParams.get("status")).toBe("eq.active");
    expect(url.searchParams.get("is_class_monitor")).toBe("eq.true");
    expect(url.searchParams.get("opening_balance")).toBe("gt.0");
    expect(url.searchParams.get("school_id")).toBe("eq.school-a");
  });
  it("cannot turn typed filter punctuation into a broader server expression", () => {
    expect(searchWords("Nakato),school_id.neq.other")).toEqual(["Nakato", "school", "id", "neq", "other"]);
    expect(searchWords("Nambi O'Connor")).toEqual(["Nambi", "O'Connor"]);
  });
});
