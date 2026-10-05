import { answerLocally, getPageHints, KNOWLEDGE, OWLY_TOPICS } from "@/lib/owly-knowledge";

describe("Owly offline knowledge base", () => {
  it("covers the core school workflows", () => {
    expect(answerLocally("how do I record a payment?")).toContain("Fees");
    expect(answerLocally("how do I mark attendance?")).toContain("Absent");
    expect(answerLocally("how do I enter marks?")).toContain("CA1");
    expect(answerLocally("how do I print report cards?")).toContain("Batch Reports");
    expect(answerLocally("where is the timetable?")).toContain("Timetable");
  });

  it("answers questions about the app itself", () => {
    expect(answerLocally("what can you help me with?")).toContain("SkoolMate");
    expect(answerLocally("where do I find the SMS centre?")).toContain("SMS");
    expect(answerLocally("how do I send bulk sms to parents?")).toMatch(/Bulk SMS/);
    expect(answerLocally("what keyboard shortcuts exist?")).toMatch(/Ctrl\+K|Ctrl\+N/);
    expect(answerLocally("which plan costs how much?")).toMatch(/UGX/);
  });

  it("explains offline behaviour without any network", () => {
    const offline = answerLocally("does this work with no internet?");
    expect(offline).toContain("Offline");
    expect(offline).toContain("Sync Center");
  });

  it("uses page context to pick a relevant answer", () => {
    const onFees = answerLocally("how do I do this?", { page: "/dashboard/fees" });
    const general = answerLocally("how do I do this?");
    expect(general).not.toEqual(onFees);
    expect(onFees).toContain("Fees");
  });

  it("falls back to a topic list for unknown questions", () => {
    const unknown = answerLocally("what is the airspeed velocity of an unladen swallow?");
    expect(unknown).toContain("WhatsApp");
    OWLY_TOPICS.forEach((topic) => expect(typeof topic).toBe("string"));
  });

  it("has no empty answers", () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.id).toBeTruthy();
      expect(entry.keywords.length).toBeGreaterThan(0);
      expect(entry.answer.trim().length).toBeGreaterThan(40);
    }
  });

  it("suggests page-aware quick hints", () => {
    expect(getPageHints("/dashboard/fees")[0]).toContain("payment");
    expect(getPageHints("/dashboard/attendance")[0]).toContain("offline");
    expect(getPageHints("/dashboard")[0]).toBeTruthy();
  });
});
