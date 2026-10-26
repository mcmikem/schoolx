/**
 * Offline list screens must not pass stale rows off as current. The notice
 * appears only when offline AND the cache is 12+ hours old — fresh data and
 * online browsing stay quiet.
 */

import { render, screen } from "@testing-library/react";

jest.mock("@/lib/useSyncStatus", () => ({
  useSyncStatus: () => mockStatus,
}));

let mockStatus: { isOnline: boolean; lastSyncedPerTable: Record<string, Date> } = {
  isOnline: false,
  lastSyncedPerTable: {},
};

import { StaleDataNotice } from "@/components/dashboard/StaleDataNotice";

describe("StaleDataNotice", () => {
  it("stays silent when online", () => {
    mockStatus = { isOnline: true, lastSyncedPerTable: { students: new Date(0) } };
    render(<StaleDataNotice tables="students" />);
    expect(screen.queryByText(/Offline · showing data saved/)).toBeNull();
  });

  it("stays silent when the cache is fresh", () => {
    mockStatus = { isOnline: false, lastSyncedPerTable: { students: new Date() } };
    render(<StaleDataNotice tables="students" />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("says when the data was saved once it is old and offline", () => {
    mockStatus = { isOnline: false, lastSyncedPerTable: { students: new Date(Date.now() - 13 * 3600_000) } };
    render(<StaleDataNotice tables="students" />);
    expect(screen.getByRole("status")).toHaveTextContent(/Offline · showing data saved/);
  });

  it("uses the freshest table when several are checked", () => {
    mockStatus = {
      isOnline: false,
      lastSyncedPerTable: {
        students: new Date(Date.now() - 20 * 3600_000),
        fee_payments: new Date(Date.now() - 13 * 3600_000),
      },
    };
    render(<StaleDataNotice tables={["students", "fee_payments"]} />);
    expect(screen.getByRole("status")).toHaveTextContent(/Offline · showing data saved/);
  });
});
