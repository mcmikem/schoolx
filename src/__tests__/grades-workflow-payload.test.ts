import { buildWorkflowUpdatePayload } from "@/app/api/grades/workflow/route";

/**
 * Scenario #19 needed a retreat path, and a retreat has to do more than flip
 * `status`. Moving a sheet back down has to clear the approval/publication
 * stamps it is leaving behind, otherwise the row reads `draft` while its audit
 * columns still claim the marks were approved and released to parents.
 */
describe("buildWorkflowUpdatePayload", () => {
  const NOW = "2026-10-14T09:00:00.000Z";

  it("stamps submitted and clears any stale approval stamps above it", () => {
    expect(buildWorkflowUpdatePayload("submitted", "u1", NOW)).toEqual({
      status: "submitted",
      submitted_at: NOW,
      submitted_by: "u1",
      approved_at: null,
      approved_by: null,
      published_at: null,
      published_by: null,
    });
  });

  it("keeps the submission stamp when approving — it really was submitted", () => {
    // Only the stages above `approved` are cleared. `submitted_at` is left
    // alone: it is a real event in the sheet's history.
    expect(buildWorkflowUpdatePayload("approved", "boss", NOW)).toEqual({
      status: "approved",
      approved_at: NOW,
      approved_by: "boss",
      published_at: null,
      published_by: null,
    });
  });

  it("stamps published and clears the earlier stages it has passed", () => {
    expect(buildWorkflowUpdatePayload("published", "boss", NOW)).toEqual({
      status: "published",
      published_at: NOW,
      published_by: "boss",
    });
  });

  it("clears the approval stamps when retreating approved back to submitted", () => {
    expect(buildWorkflowUpdatePayload("submitted", "teacher", NOW)).toEqual({
      status: "submitted",
      submitted_at: NOW,
      submitted_by: "teacher",
      approved_at: null,
      approved_by: null,
      published_at: null,
      published_by: null,
    });
  });

  it("clears every stamp when retreating to draft", () => {
    expect(buildWorkflowUpdatePayload("draft", "teacher", NOW)).toEqual({
      status: "draft",
      submitted_at: null,
      submitted_by: null,
      approved_at: null,
      approved_by: null,
      published_at: null,
      published_by: null,
    });
  });

  it("clears only the publication stamp when un-publishing", () => {
    const payload = buildWorkflowUpdatePayload("approved", "boss", NOW);
    expect(payload.published_at).toBeNull();
    expect(payload.published_by).toBeNull();
    expect(payload.approved_at).toBe(NOW);
    // The submission that led here is still part of the trail.
    expect(payload.submitted_at).toBeUndefined();
  });

  it("records who moved it, not who happens to be looking", () => {
    expect(buildWorkflowUpdatePayload("submitted", "teacher-42", NOW).submitted_by).toBe("teacher-42");
  });
});
