import { describe, expect, it } from "@jest/globals";
import { sanitizeTelemetryEvents } from "@/lib/telemetry-sanitizer";

describe("telemetry payload minimization", () => {
  it("drops query strings, metadata, contact data, and user identifiers", () => {
    expect(
      sanitizeTelemetryEvents({
        events: [
          {
            event_type: "page_view",
            event_name: "/dashboard/students/123?parent=Jane%40school.test",
            url: "https://skoolmate.test/dashboard/students/123?reset_token=secret#section",
            user_id: "forged-user",
            school_id: "forged-school",
            metadata: { email: "parent@school.test", query: "password=secret" },
          },
        ],
      }),
    ).toEqual([
      {
        event_type: "page_view",
        event_name: "/dashboard/students/:id",
        url: "/dashboard/students/:id",
      },
    ]);
  });

  it("rejects invalid types and oversized batches", () => {
    expect(sanitizeTelemetryEvents({ event_type: "delete_all", event_name: "test" })).toBeNull();
    expect(
      sanitizeTelemetryEvents({
        events: Array.from({ length: 31 }, () => ({ event_type: "page_view", event_name: "/" })),
      }),
    ).toBeNull();
  });

  it("redacts email and phone-like strings from event names", () => {
    const [event] =
      sanitizeTelemetryEvents({ event_type: "error", event_name: "failed for parent@example.test +256 700 111 222" }) ||
      [];
    expect(event.event_name).toBe("failed for [email] [number]");
  });
});
