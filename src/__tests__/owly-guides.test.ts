import fs from "node:fs";
import path from "node:path";
import { getGuide, guideToMessage, OWLY_GUIDES } from "@/lib/owly-guides";

describe("owly guides", () => {
  it("every guide has an id that matches its key and at least one step", () => {
    Object.entries(OWLY_GUIDES).forEach(([key, guide]) => {
      expect(guide.id).toBe(key);
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.steps.length).toBeGreaterThan(0);
    });
  });

  it("renders numbered steps as assistant text", () => {
    const guide = getGuide("fees");
    expect(guide).not.toBeNull();
    const message = guideToMessage(guide!);
    expect(message).toContain("**How to manage fees**");
    expect(message).toContain("1. **Create Fee:**");
    expect(message).toContain("5. **Adjustments:**");
  });

  it("has a guide for every onboarding help step", () => {
    ["setup-school", "setup-fees", "setup-grading", "setup-services", "setup-review"].forEach((id) => {
      expect(getGuide(id)).not.toBeNull();
    });
  });

  it("every guideId used by a page exists", () => {
    const pages = [
      "src/app/dashboard/fees/page.tsx",
      "src/app/dashboard/students/page.tsx",
      "src/app/dashboard/staff/page.tsx",
      "src/app/dashboard/messages/page.tsx",
      "src/app/dashboard/attendance/page.tsx",
      "src/app/dashboard/grades/page.tsx",
    ];
    const used = new Set<string>();
    pages.forEach((page) => {
      const source = fs.readFileSync(path.join(process.cwd(), page), "utf8");
      for (const match of source.matchAll(/guideId="([^"]+)"/g)) used.add(match[1]);
    });
    expect(used.size).toBeGreaterThan(0);
    used.forEach((id) => expect(getGuide(id)).not.toBeNull());
  });
});
