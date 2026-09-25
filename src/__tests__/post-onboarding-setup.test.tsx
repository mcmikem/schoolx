/**
 * Regression tests for the Optional Setup sign-in nag.
 *
 * PostOnboardingSetup used to render OPEN before its async completion status
 * finished loading, so fully-configured schools saw the "Optional Setup"
 * panel pop up on every single sign-in. It must now stay hidden until the
 * load proves there is still work left — and unmount silently when there
 * isn't. They run entirely in JSDOM with mocked data layer.
 */
import { render, screen, waitFor } from "@testing-library/react";
import PostOnboardingSetup from "@/components/onboarding/PostOnboardingSetup";

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "Test School" },
    isDemo: false,
    refreshSchool: jest.fn(),
  }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({
    success: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warning: jest.fn(),
  }),
}));

const loadSchoolSettingMock = jest.fn();
jest.mock("@/lib/school-settings", () => ({
  loadSchoolSetting: (...args: unknown[]) => loadSchoolSettingMock(...args),
  saveSchoolSetting: jest.fn(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: () => null,
}));

const ALL_DONE = {
  sms_automation: "completed",
  import_students: "completed",
  signatures: "skipped",
  dormitories: "completed",
  houses: "skipped",
};

beforeEach(() => {
  loadSchoolSettingMock.mockReset();
});

describe("PostOnboardingSetup sign-in nag", () => {
  it("renders nothing while completion status is still loading", () => {
    loadSchoolSettingMock.mockReturnValue(new Promise(() => {}));
    const { container } = render(<PostOnboardingSetup onComplete={jest.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("unmounts silently via onComplete when everything is already done", async () => {
    loadSchoolSettingMock.mockResolvedValue(ALL_DONE);
    const onComplete = jest.fn();
    render(<PostOnboardingSetup onComplete={onComplete} />);
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Optional Setup")).not.toBeInTheDocument();
  });

  it("opens the panel when optional steps remain", async () => {
    loadSchoolSettingMock.mockResolvedValue({});
    const onComplete = jest.fn();
    render(<PostOnboardingSetup onComplete={onComplete} />);
    await waitFor(() => expect(screen.getByText("Optional Setup")).toBeInTheDocument());
    expect(onComplete).not.toHaveBeenCalled();
  });
});
