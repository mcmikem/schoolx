import { act, render } from "@testing-library/react";
import { useAuth } from "@/lib/auth-context";
import { askOwly } from "@/lib/owly-bus";
import OwlAssistant from "@/components/OwlAssistant";

/**
 * Any part of the app can hand Owly a guide or an error. The assistant must
 * open itself and answer locally, so this works offline and without an AI key.
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

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", role: "bursar", roles: ["bursar"] },
  } as unknown as ReturnType<typeof useAuth>);
});

describe("Owly receives requests from the app", () => {
  it("opens with a page guide", () => {
    render(<OwlAssistant />);

    act(() => {
      askOwly({ kind: "guide", guideId: "fees" });
    });

    expect(document.querySelector("div[data-owl-assistant]")).not.toBeNull();
    expect(document.body.textContent).toContain("How to manage fees");
    expect(document.body.textContent).toContain("Create Fee");
  });

  it("opens with an explanation of an error", () => {
    render(<OwlAssistant />);

    act(() => {
      askOwly({ kind: "error", message: "Failed to fetch" });
    });

    expect(document.querySelector("div[data-owl-assistant]")).not.toBeNull();
    expect(document.body.textContent).toContain("That did not reach the server");
    expect(document.body.textContent).toContain("Failed to fetch");
  });

  it("opens the walkthrough for the user's role on a tour request", () => {
    render(<OwlAssistant />);

    act(() => {
      askOwly({ kind: "tour" });
    });

    expect(document.querySelector("div[data-owl-walkthrough]")).not.toBeNull();
    expect(document.body.textContent).toContain("Fees and payments, start to finish");
  });

  it("pre-fills a free-form question", () => {
    render(<OwlAssistant />);

    act(() => {
      askOwly({ kind: "ask", question: "How do I record a payment?" });
    });

    const input = document.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("How do I record a payment?");
  });

  it("ignores a guide id that does not exist", () => {
    render(<OwlAssistant />);

    act(() => {
      askOwly({ kind: "guide", guideId: "not-a-guide" });
    });

    expect(document.querySelector("div[data-owl-assistant]")).toBeNull();
  });
});
