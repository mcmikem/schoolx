import { fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/lib/auth-context";
import OwlAssistant from "@/components/OwlAssistant";

/**
 * Owly's interruption policy and exit paths.
 *
 * Two things must stay true:
 *   1. The launcher only throws a suggestion at someone who looks stuck. Being
 *      new or offline is not a reason to interrupt.
 *   2. Dismissing Owly dismisses it. The launcher used to decide from "does
 *      Owly have a suggestion?" rather than "is the assistant open?", so while
 *      it was blinking the close button opened the suggestion popup instead.
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

const fab = () => document.querySelector<HTMLButtonElement>("button[data-owl-assistant]");
const walkthrough = () => document.querySelector("[data-owl-walkthrough]");
const suggestion = () => document.querySelector("[data-owl-suggestion]");
const chat = () => document.querySelector("div[data-owl-assistant]");

const seedVisits = (page: string, count: number) => {
  localStorage.setItem("owly_seen_v1::u1", JSON.stringify(true));
  localStorage.setItem("owly_visits_v1::u1", JSON.stringify({ pages: { [page]: count }, total: count }));
};

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", role: "teacher", roles: ["teacher"] },
  } as unknown as ReturnType<typeof useAuth>);
});

describe("Owly only interrupts a stuck user", () => {
  it("opens the chat, not a suggestion, for a first-time user", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    expect(suggestion()).toBeNull();
    expect(chat()).not.toBeNull();
  });

  it("offers a suggestion after the same page has been opened three times", () => {
    seedVisits("/dashboard/fees", 3);
    render(<OwlAssistant />);

    // Nothing pops up on its own; the badge waits to be tapped.
    expect(suggestion()).toBeNull();

    fireEvent.click(fab()!);
    expect(suggestion()).not.toBeNull();
    expect(chat()).toBeNull();
    expect(screen.getByText("Recording your first payment?")).toBeInTheDocument();
  });

  it("does not re-show a suggestion the user waved away", () => {
    seedVisits("/dashboard/fees", 3);
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(suggestion()).toBeNull();

    // The launcher is no longer blinking, so the next tap opens the chat.
    fireEvent.click(fab()!);
    expect(suggestion()).toBeNull();
    expect(chat()).not.toBeNull();
  });
});

describe("closing Owly", () => {
  it("closes the tour instead of revealing or opening another window", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    fireEvent.click(screen.getByRole("button", { name: "Show me around" }));
    expect(walkthrough()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close walkthrough" }));
    expect(walkthrough()).toBeNull();
    expect(suggestion()).toBeNull();
    expect(chat()).toBeNull();
  });

  it("closes the launcher itself when the assistant is open", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    expect(chat()).not.toBeNull();

    fireEvent.click(fab()!);
    expect(chat()).toBeNull();
    expect(suggestion()).toBeNull();
  });

  it("closes on Escape", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    expect(chat()).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(chat()).toBeNull();
  });
});
