import { fireEvent, render, screen } from "@testing-library/react";
import { StorageWarning } from "@/components/StorageWarning";
import type { StorageHealth } from "@/lib/storage-health";

let health: StorageHealth;

jest.mock("@/lib/useStorageHealth", () => ({
  useStorageHealth: () => ({ health, refresh: jest.fn() }),
}));

const MB = 1024 * 1024;

function setHealth(overrides: Partial<StorageHealth>) {
  health = {
    supported: true,
    persisted: true,
    usage: 50 * MB,
    quota: 100 * MB,
    free: 50 * MB,
    usedPercent: 50,
    level: "ok",
    ...overrides,
  };
}

beforeEach(() => {
  sessionStorage.clear();
  setHealth({});
});

describe("storage warning", () => {
  it("stays out of the way when there is room", () => {
    render(<StorageWarning />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("names the real free space and points at what is saved", () => {
    setHealth({ usage: 80 * MB, free: 20 * MB, usedPercent: 80, level: "low" });
    render(<StorageWarning />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent(/20 MB left/);
    expect(banner).toHaveTextContent(/changes saved on this phone are safe/i);
    expect(screen.getByRole("link", { name: /see what is saved/i }).getAttribute("href")).toMatch(
      /^\/dashboard\/sync-center\/?$/,
    );
  });

  it("uses an assertive alert when a write can fail", () => {
    setHealth({ usage: 95 * MB, free: 5 * MB, usedPercent: 95, level: "critical" });
    render(<StorageWarning />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/almost full/i);
    expect(alert).toHaveTextContent(/5\.0 MB left/);
  });

  it("can be dismissed for the session", () => {
    setHealth({ level: "low", free: 20 * MB });
    render(<StorageWarning />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss storage warning/i }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("skoolmate:storage-warning-dismissed")).toBe("1");
  });
});
