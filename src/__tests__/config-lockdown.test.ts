import { FEATURE_STAGES } from "@/lib/featureStages";
import { navigationByRole } from "@/lib/navigation";
import { ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/roles";

describe("config lockdown", () => {
  it("freezes feature stage definitions deeply", () => {
    expect(Object.isFrozen(FEATURE_STAGES)).toBe(true);
    expect(Object.isFrozen(FEATURE_STAGES.full)).toBe(true);
    expect(Object.isFrozen(FEATURE_STAGES.full.modules)).toBe(true);
  });

  it("freezes role permissions and labels deeply", () => {
    expect(Object.isFrozen(ROLE_PERMISSIONS)).toBe(true);
    expect(Object.isFrozen(ROLE_PERMISSIONS.headmaster)).toBe(true);
    expect(Object.isFrozen(ROLE_LABELS)).toBe(true);
  });

  it("freezes navigation config deeply", () => {
    expect(Object.isFrozen(navigationByRole)).toBe(true);
    expect(Object.isFrozen(navigationByRole.headmaster)).toBe(true);
    expect(Object.isFrozen(navigationByRole.headmaster[0])).toBe(true);
    expect(Object.isFrozen(navigationByRole.headmaster[0].items)).toBe(true);
    expect(Object.isFrozen(navigationByRole.headmaster[0].items[0])).toBe(true);
  });
});
