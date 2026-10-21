import { fireEvent, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/Toast";
import { subscribeOwly } from "@/lib/owly-bus";

function Trigger({ kind }: { kind: "error" | "success" }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => (kind === "error" ? toast.error("Failed to fetch") : toast.success("Saved"))}>
      {kind}
    </button>
  );
}

describe("error toasts hand off to Owly", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("adds an Ask Owly action and sends the error message", () => {
    const listener = jest.fn();
    const off = subscribeOwly(listener);

    render(
      <ToastProvider>
        <Trigger kind="error" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "error" }));
    expect(screen.getByText("Failed to fetch")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ask Owly" }));
    expect(listener).toHaveBeenCalledWith({ kind: "error", message: "Failed to fetch" });

    off();
  });

  it("does not add the action to a success confirmation", () => {
    render(
      <ToastProvider>
        <Trigger kind="success" />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "success" }));
    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask Owly" })).toBeNull();
  });
});
