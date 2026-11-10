import { getGuidedTourTask } from "@/lib/guided-tour-content";

describe("getGuidedTourTask", () => {
  it("gives teachers a task focused on taking attendance", () => {
    expect(getGuidedTourTask(["teacher"])).toContain("open Attendance");
  });

  it("gives bursars a task focused on the fee ledger", () => {
    expect(getGuidedTourTask(["bursar"])).toContain("fee ledger");
  });

  it("uses the primary role before secondary roles", () => {
    expect(getGuidedTourTask(["teacher", "bursar"])).toContain("open Attendance");
  });

  it("provides useful guidance for an unlisted role", () => {
    expect(getGuidedTourTask(["unknown_role"])).toContain("choose the school tool");
  });
});
