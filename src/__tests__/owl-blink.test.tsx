import { render } from "@testing-library/react";
import { useAuth } from "@/lib/auth-context";
import OwlAssistant from "@/components/OwlAssistant";
import OwlMascot from "@/components/brand/OwlMascot";

/**
 * Owly blinks.
 *
 * The lids used to be styled and positioned but never rendered, so the owl sat
 * with wide-open eyes forever and the blink was invisible. These assertions
 * only care that the lids exist in the DOM: the motion itself is CSS.
 */

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/dashboard/fees",
}));

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock("@/components/BugReportButton", () => ({ BugReportModal: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: (props: object) => <img alt="" {...props} /> }));

const lids = (container: HTMLElement) => container.querySelectorAll(".owly-eyelid");

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", role: "teacher", roles: ["teacher"] },
  } as unknown as ReturnType<typeof useAuth>);
});

describe("Owly blinks", () => {
  it("gives the launcher two eye lids", () => {
    const { container } = render(<OwlAssistant />);
    expect(lids(container).length).toBeGreaterThanOrEqual(2);
  });

  it("blinks the mascot when it is animated", () => {
    const { container } = render(<OwlMascot size={52} animated />);
    expect(lids(container)).toHaveLength(2);
  });

  it("leaves a still mascot alone", () => {
    const { container } = render(<OwlMascot size={52} />);
    expect(lids(container)).toHaveLength(0);
  });

  it("blinks a still mascot on request", () => {
    const { container } = render(<OwlMascot size={52} blink />);
    expect(lids(container)).toHaveLength(2);
  });
});
