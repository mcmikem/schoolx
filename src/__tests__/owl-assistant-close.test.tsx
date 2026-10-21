import { fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/lib/auth-context";
import OwlAssistant from "@/components/OwlAssistant";

/**
 * Dismissing Owly must dismiss it.
 *
 * The launcher used to decide what to do from "does Owly have a suggestion?"
 * rather than "is the assistant open?", so while Owly was blinking the close
 * button toggled the suggestion popup and the user got a second window every
 * time they tried to shut the first. These tests pin the exit paths.
 */

jest.mock("@/lib/auth-context", () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

jest.mock("@/lib/supabase", () => ({ supabase: { auth: { getSession: jest.fn() } } }));
jest.mock("@/components/BugReportButton", () => ({ BugReportModal: () => null }));
jest.mock("next/image", () => ({ __esModule: true, default: (props: object) => <img alt="" {...props} /> }));

const fab = () => document.querySelector<HTMLButtonElement>("button[data-owl-assistant]");
const walkthrough = () => document.querySelector("[data-owl-walkthrough]");
const suggestion = () => document.querySelector("[data-owl-suggestion]");
const chat = () => document.querySelector("div[data-owl-assistant]");

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", role: "teacher", roles: ["teacher"] },
  } as unknown as ReturnType<typeof useAuth>);
});

describe("closing Owly", () => {
  it("closes the walkthrough instead of opening the suggestion popup", () => {
    render(<OwlAssistant />);

    // A new user makes Owly blink; the first tap opens its suggestion.
    fireEvent.click(fab()!);
    expect(suggestion()).not.toBeNull();

    // Acting on it starts the guided tour, which opens the assistant too.
    fireEvent.click(screen.getByRole("button", { name: "Show me around" }));
    expect(walkthrough()).not.toBeNull();
    expect(chat()).not.toBeNull();

    // The launcher now shows a close icon. Tapping it must leave nothing open.
    fireEvent.click(fab()!);
    expect(walkthrough()).toBeNull();
    expect(suggestion()).toBeNull();
    expect(chat()).toBeNull();
  });

  it("closes on Escape", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    fireEvent.click(screen.getByRole("button", { name: "Show me around" }));
    expect(walkthrough()).not.toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(walkthrough()).toBeNull();
    expect(chat()).toBeNull();
  });

  it("does not re-show a suggestion the user waved away", () => {
    render(<OwlAssistant />);

    fireEvent.click(fab()!);
    expect(suggestion()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(suggestion()).toBeNull();

    // The launcher is no longer blinking, so the next tap opens the chat.
    fireEvent.click(fab()!);
    expect(suggestion()).toBeNull();
    expect(chat()).not.toBeNull();
  });
});
