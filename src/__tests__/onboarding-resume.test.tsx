import { fireEvent, render, screen } from "@testing-library/react";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

const mockAutoSave = jest.fn();
const mockFrom = jest.fn();
const mockLoad = jest.fn();
jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: {
      id: "school-1",
      name: "Example School",
      school_type: "primary",
      district: "Kampala",
      subscription_plan: "growth",
    },
    refreshSchool: jest.fn(),
  }),
}));
jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/setup-wizard",
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock("@/components/Toast", () => ({
  useToast: () => ({ info: jest.fn(), error: jest.fn(), success: jest.fn() }),
}));
jest.mock("@/lib/supabase", () => ({ supabase: { from: (...args: unknown[]) => mockFrom(...args) } }));
jest.mock("@/lib/hooks/useAutoSave", () => ({
  useAutoSave: (options: unknown) => {
    mockAutoSave(options);
    return { loadFromStorage: mockLoad, clearDraft: jest.fn(), storageAvailable: true };
  },
}));

describe("school setup resume", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockReturnValue(null);
  });

  it("keeps restored term dates, subject choices and boarding details instead of applying defaults again", () => {
    const terms = [{ name: "Term 1", code: "T1", term_number: 1, start: "2026-02-10", end: "2026-05-08" }];
    const boardingConfig = {
      hasBoarding: true,
      dormCount: 1,
      dormitories: [{ name: "East", type: "boys", capacity: 35 }],
      hasHouses: false,
      houseCount: 0,
      houses: [],
    };
    mockLoad.mockReturnValue({
      schoolDetails: {
        name: "Restored School",
        ownership: "private",
        district: "Kampala",
        motto: "",
        phone: "",
        email: "",
        uneb_center_number: "",
        subcounty: "",
        parish: "",
        address: "",
      },
      localSchoolType: "secondary",
      localHasNursery: false,
      selectedSubjects: ["English"],
      customSubjects: [],
      terms,
      boardingConfig,
      completedSteps: [],
      step: 1,
    });
    render(<OnboardingFlow onComplete={jest.fn()} />);
    const data = mockAutoSave.mock.calls[mockAutoSave.mock.calls.length - 1][0].data;
    expect(data.terms).toEqual(terms);
    expect(data.selectedSubjects).toEqual(["English"]);
    expect(data.boardingConfig).toEqual(boardingConfig);
    expect(screen.getByLabelText(/School Name/)).toHaveValue("Restored School");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("pauses without jumping to finish or marking school setup complete", () => {
    const onDismiss = jest.fn();
    const onComplete = jest.fn();
    render(<OnboardingFlow onDismiss={onDismiss} onComplete={onComplete} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Pause setup — come back later" })[0]);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /^Finish setup$/ })).not.toBeInTheDocument();
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
