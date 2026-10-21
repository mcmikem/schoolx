import { fireEvent, render, screen } from "@testing-library/react";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { OwlyHelpLink } from "@/components/owly/OwlyHelpLink";
import { askOwly } from "@/lib/owly-bus";

jest.mock("@/lib/owly-bus", () => ({ askOwly: jest.fn(() => true) }));

const mockAskOwly = askOwly as jest.MockedFunction<typeof askOwly>;

beforeEach(() => {
  mockAskOwly.mockClear();
});

describe("empty states hand guidance to Owly", () => {
  it("asks the empty-state question", () => {
    render(<EmptyState title="No payments recorded" owlyQuestion="How do I record a payment?" />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Owly" }));

    expect(mockAskOwly).toHaveBeenCalledWith({ kind: "ask", question: "How do I record a payment?" });
  });

  it("does not show the action without a question", () => {
    render(<EmptyState title="No results" />);
    expect(screen.queryByRole("button", { name: "Ask Owly" })).toBeNull();
  });

  it("explains an error from ErrorState", () => {
    render(<ErrorState message="Failed to fetch" />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Owly" }));

    expect(mockAskOwly).toHaveBeenCalledWith({ kind: "error", message: "Failed to fetch" });
  });

  it("asks from an informational banner", () => {
    render(<OwlyHelpLink question="How do backups work?" />);

    fireEvent.click(screen.getByRole("button", { name: "Ask Owly" }));

    expect(mockAskOwly).toHaveBeenCalledWith({ kind: "ask", question: "How do backups work?" });
  });
});
