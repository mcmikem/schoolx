import { render } from "@testing-library/react";
import { useAuth } from "@/lib/auth-context";
import OwlAssistant from "@/components/OwlAssistant";

/**
 * Mounting is not optional for this component.
 *
 * A `const` read before its declaration threw a temporal-dead-zone
 * ReferenceError on first render, which the dashboard layout's ErrorBoundary
 * turned into a whole-app "Something went wrong" screen. Neither `tsc` nor
 * `next build` caught it: the offending read sat inside a closure (so no
 * use-before-declaration error) and the component is `dynamic(..., {ssr:false})`
 * (so nothing executes it at build time). Only rendering it does.
 *
 * So these tests render it, across the auth shapes it has to survive.
 */

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock("@/components/BugReportButton", () => ({ BugReportModal: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: (props: object) => <img alt="" {...props} /> }));

const auth = (over: Record<string, unknown> = {}) =>
  ({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", role: "teacher", roles: ["teacher"] },
    ...over,
  }) as unknown as ReturnType<typeof useAuth>;

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue(auth());
});

describe("Owly mounts", () => {
  it("with a signed-in teacher", () => {
    expect(() => render(<OwlAssistant />)).not.toThrow();
  });

  it("before auth has resolved", () => {
    // user is null on first paint of every dashboard load.
    mockUseAuth.mockReturnValue(auth({ user: null, school: null }));
    expect(() => render(<OwlAssistant />)).not.toThrow();
  });

  it("for a user holding several roles", () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: "u1", role: "teacher", roles: ["headmaster", "teacher"] } }));
    expect(() => render(<OwlAssistant />)).not.toThrow();
  });

  it("with a legacy single-role profile that has no roles array", () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: "u1", role: "bursar" } }));
    expect(() => render(<OwlAssistant />)).not.toThrow();
  });

  it("when the user has no walkthrough of their own", () => {
    mockUseAuth.mockReturnValue(auth({ user: { id: "u1", role: "librarian", roles: ["librarian"] } }));
    expect(() => render(<OwlAssistant />)).not.toThrow();
  });
});

describe("Owly does not inherit another user's transcript", () => {
  it("ignores a pre-scoping global key left by a previous session", () => {
    localStorage.setItem("skoolmate_owly_messages_v1", JSON.stringify([{ role: "user", text: "salaries", time: "9:00" }]));
    render(<OwlAssistant />);
    expect(document.body.textContent).not.toContain("salaries");
  });
});
