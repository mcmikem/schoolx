/**
 * Unit tests for the RegisterPage multi-step form validation.
 *
 * "Lock" intent: these tests prevent regressions in step navigation, field
 * validation messages, and form structure.  They run entirely in JSDOM with
 * no network calls — any change that breaks validation messages, step
 * progression, or back-navigation will fail here immediately.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import RegisterPage from "@/app/register/page";

// supabase, useRouter, and localStorage are mocked via jest.setup.ts

// ─── helpers ────────────────────────────────────────────────────────────────

function advanceToStep2() {
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText(/school name/i), {
    target: { value: "Test School Alpha" },
  });
  fireEvent.click(screen.getByRole("button", { name: /next.*where/i }));
}

function advanceToStep3() {
  advanceToStep2();
  fireEvent.change(screen.getByLabelText(/district/i), {
    target: { value: "Kampala" },
  });
  fireEvent.change(screen.getByLabelText(/sub-county/i), {
    target: { value: "Central Division" },
  });
  fireEvent.click(screen.getByRole("button", { name: /next.*account/i }));
}

/**
 * Submit step 3 via the form's submit event.
 * fireEvent.click on a submit button doesn't always trigger onSubmit in JSDOM
 * unless a prior re-render has happened; fireEvent.submit is more reliable.
 */
function submitStep3() {
  const submitBtn = screen.getByRole("button", { name: /finish.*start/i });
  fireEvent.submit((submitBtn as HTMLButtonElement).closest("form")!);
}

// ─── tests ──────────────────────────────────────────────────────────────────

describe("RegisterPage – step 1 (School Info)", () => {
  it("renders the step 1 progress indicator on initial load", () => {
    render(<RegisterPage />);
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
  });

  it("shows an error when school name is empty", () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: /next.*where/i }));
    expect(
      screen.getByText(/school name is required/i),
    ).toBeInTheDocument();
  });

  it("shows an error when school name has fewer than 3 characters", () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/school name/i), {
      target: { value: "AB" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next.*where/i }));
    expect(
      screen.getByText(/at least 3 characters/i),
    ).toBeInTheDocument();
  });

  it("clears the error message when the user starts typing after an error", () => {
    render(<RegisterPage />);
    fireEvent.click(screen.getByRole("button", { name: /next.*where/i }));
    expect(
      screen.getByText(/school name is required/i),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/school name/i), {
      target: { value: "X" },
    });
    expect(
      screen.queryByText(/school name is required/i),
    ).not.toBeInTheDocument();
  });

  it("advances to step 2 with a valid school name", () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/school name/i), {
      target: { value: "St. Mary Primary School" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next.*where/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
  });
});

describe("RegisterPage – step 2 (Location)", () => {
  it("shows step 2 fields after advancing from step 1", () => {
    advanceToStep2();
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/district/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/sub-county/i)).toBeInTheDocument();
  });

  it("shows an error when district is not selected", () => {
    advanceToStep2();
    fireEvent.click(screen.getByRole("button", { name: /next.*account/i }));
    expect(
      screen.getByText(/please select a district/i),
    ).toBeInTheDocument();
  });

  it("shows an error when sub-county is empty", () => {
    advanceToStep2();
    fireEvent.change(screen.getByLabelText(/district/i), {
      target: { value: "Kampala" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next.*account/i }));
    expect(
      screen.getByText(/sub-county is required/i),
    ).toBeInTheDocument();
  });

  it("back button returns to step 1 and preserves the school name", () => {
    advanceToStep2();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 1 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/school name/i)).toHaveValue(
      "Test School Alpha",
    );
  });

  it("advances to step 3 with valid district and sub-county", () => {
    advanceToStep2();
    fireEvent.change(screen.getByLabelText(/district/i), {
      target: { value: "Kampala" },
    });
    fireEvent.change(screen.getByLabelText(/sub-county/i), {
      target: { value: "Central Division" },
    });
    fireEvent.click(screen.getByRole("button", { name: /next.*account/i }));
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
  });
});

describe("RegisterPage – step 3 (Account Setup)", () => {
  it("shows step 3 fields after advancing from step 2", () => {
    advanceToStep3();
    expect(screen.getByText(/step 3 of 3/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/your phone number/i)).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/min 6 characters/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter password again/i),
    ).toBeInTheDocument();
  });

  it("shows an error when admin name is missing", () => {
    advanceToStep3();
    submitStep3();
    expect(
      screen.getByText(/admin name is required/i),
    ).toBeInTheDocument();
  });

  it("shows an error when admin name is too short", () => {
    advanceToStep3();
    fireEvent.change(screen.getByLabelText(/your full name/i), {
      target: { value: "A" },
    });
    submitStep3();
    expect(
      screen.getByText(/at least 2 characters/i),
    ).toBeInTheDocument();
  });

  it("shows an error when admin phone is missing", () => {
    advanceToStep3();
    fireEvent.change(screen.getByLabelText(/your full name/i), {
      target: { value: "John Admin" },
    });
    submitStep3();
    expect(
      screen.getByText(/admin phone is required/i),
    ).toBeInTheDocument();
  });

  it("shows an error when password is fewer than 6 characters", () => {
    advanceToStep3();
    fireEvent.change(screen.getByLabelText(/your full name/i), {
      target: { value: "John Admin" },
    });
    fireEvent.change(screen.getByLabelText(/your phone number/i), {
      target: { value: "0700000000" },
    });
    fireEvent.change(screen.getByPlaceholderText(/min 6 characters/i), {
      target: { value: "abc" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/enter password again/i),
      { target: { value: "abc" } },
    );
    submitStep3();
    expect(
      screen.getByText(/password must be at least 6/i),
    ).toBeInTheDocument();
  });

  it("shows an error when passwords do not match", () => {
    advanceToStep3();
    fireEvent.change(screen.getByLabelText(/your full name/i), {
      target: { value: "John Admin" },
    });
    fireEvent.change(screen.getByLabelText(/your phone number/i), {
      target: { value: "0700000000" },
    });
    fireEvent.change(screen.getByPlaceholderText(/min 6 characters/i), {
      target: { value: "secret123" },
    });
    fireEvent.change(
      screen.getByPlaceholderText(/enter password again/i),
      { target: { value: "different456" } },
    );
    submitStep3();
    expect(
      screen.getByText(/passwords do not match/i),
    ).toBeInTheDocument();
  });

  it("back button returns to step 2", () => {
    advanceToStep3();
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText(/step 2 of 3/i)).toBeInTheDocument();
  });
});

describe("RegisterPage – sign-in link", () => {
  it("shows a link to the login page", () => {
    render(<RegisterPage />);
    const link = screen.getByRole("link", { name: /sign in/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/login");
  });
});

