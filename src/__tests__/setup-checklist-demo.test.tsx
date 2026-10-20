import { fireEvent, render, screen } from "@testing-library/react";
import SetupChecklist from "@/components/onboarding/SetupChecklist";

const mockFrom = jest.fn();
const mockFetch = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "00000000-0000-0000-0000-000000000001" },
    user: { id: "demo-headmaster" },
    isDemo: true,
  }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));

it("keeps demo checklist reads and skips local instead of invoking API cleanup or writes", () => {
  const originalFetch = global.fetch;
  global.fetch = mockFetch;
  try {
    render(<SetupChecklist showAll />);
    expect(screen.getByText("School details")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: /^Skip$/ })[0]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
  } finally {
    global.fetch = originalFetch;
  }
});
