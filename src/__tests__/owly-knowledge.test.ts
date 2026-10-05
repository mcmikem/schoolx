import { answerLocally, getPageHints, KNOWLEDGE, OWLY_TOPICS } from "@/lib/owly-knowledge";

describe("Owly offline knowledge base", () => {
  it("answers 'how do I import students from CSV?' with real import steps", () => {
    const answer = answerLocally("How do I import students from CSV?");
    expect(answer).toContain("Import students from CSV");
    expect(answer).toContain("Confirm & Import");
    expect(answer).toMatch(/\n1\. /); // numbered steps
    expect(answer).toContain("📍"); // where-to-go line
    // even when the user is on the Students page, the topic must win
    const onPage = answerLocally("How do I import students from CSV?", { page: "/dashboard/students" });
    expect(onPage).toContain("Confirm & Import");
  });

  it("covers the core school workflows with steps", () => {
    const payment = answerLocally("how do I record a payment?");
    expect(payment).toContain("Add Payment");
    expect(payment).toContain("Mobile Money");

    const attendance = answerLocally("how do I mark attendance?");
    expect(attendance).toContain("Select Class");
    expect(attendance).toContain("Save Changes");

    const grades = answerLocally("how do I enter marks?");
    expect(grades).toContain("CA1");
    expect(grades).toContain("Publish Grades");

    const reports = answerLocally("how do I print report cards?");
    expect(reports).toContain("Batch Reports");

    expect(answerLocally("where is the timetable?")).toContain("Timetable");
    expect(answerLocally("how do I send bulk sms to parents?")).toContain("Send Bulk SMS");
  });

  it("answers questions about the app itself", () => {
    expect(answerLocally("what can you help me with?")).toContain("SkoolMate");
    expect(answerLocally("where do I find the SMS centre?")).toContain("SMS");
    expect(answerLocally("what keyboard shortcuts exist?")).toMatch(/Ctrl\+K|Ctrl\+N/);
    expect(answerLocally("which plan costs how much?")).toMatch(/UGX/);
    expect(answerLocally("how do I get started?")).toContain("Setup Wizard");
  });

  it("explains offline behaviour without any network", () => {
    const offline = answerLocally("does this work with no internet?");
    expect(offline).toContain("Offline");
    expect(offline).toContain("Sync Center");
  });

  it("uses page context when the question has no topic", () => {
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

  it("renders every topic entry with a title or a free-form answer", () => {
    for (const entry of KNOWLEDGE) {
      expect(entry.id).toBeTruthy();
      expect(entry.keywords.length).toBeGreaterThan(0);
      const rendered = answerLocally(entry.keywords[0]);
      expect(rendered.trim().length).toBeGreaterThan(40);
      expect(Boolean(entry.answer) || Boolean(entry.title)).toBe(true);
    }
  });

  it("suggests page-aware quick hints", () => {
    expect(getPageHints("/dashboard/fees")[0]).toContain("payment");
    expect(getPageHints("/dashboard/attendance")[0]).toContain("offline");
    expect(getPageHints("/dashboard/import")[0]).toContain("row");
    expect(getPageHints("/dashboard")[0]).toBeTruthy();
  });
});
