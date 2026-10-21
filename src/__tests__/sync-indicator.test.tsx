import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ToastProvider } from "@/components/Toast";
import TopBar from "@/components/dashboard/TopBar";

/**
 * One sync indicator, and it says what matters.
 *
 * The sync picture used to be drawn three times over: a sidebar readout that
 * only appears when the drawer is open, a floating overlay that sat on top of
 * the page, and a top bar dot that said "Online" while records were still
 * waiting to go. All three kept their own copy of the queue length, so they
 * disagreed.
 *
 * These tests pin the one thing a teacher needs from any screen: how many
 * changes are safe on the phone and not yet on the server.
 */

const queue = { pending: 0 };
const syncToServer = jest.fn(async () => ({ success: 2, failed: 0, errors: [] }));

jest.mock("@/lib/offline", () => ({
  SYNC_QUEUE_EVENT: "skoolmate:sync-queue-changed",
  offlineDB: {
    getPendingSync: jest.fn(async () => Array.from({ length: queue.pending }, (_, i) => ({ id: i }))),
    getAllLastSynced: jest.fn(async () => ({})),
    syncToServer: (...args: unknown[]) => syncToServer(...(args as [])),
    refreshAll: jest.fn(async () => ({ synced: 0, errors: [] })),
  },
}));

const push = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn(), back: jest.fn() }),
  usePathname: () => "/dashboard/fees",
}));

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "s1", name: "Test School" },
    user: { id: "u1", full_name: "John Headmaster", email: "j@test.school", role: "headmaster" },
  }),
}));

jest.mock("@/lib/academic-context", () => ({ useAcademic: () => ({ currentTerm: "Term 1" }) }));
jest.mock("@/lib/notifications", () => ({
  useNotifications: () => ({ notifications: [], unreadCount: 0, markAsRead: jest.fn() }),
}));
jest.mock("@/lib/theme-context", () => ({ useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }) }));
jest.mock("@/contexts/SidebarContext", () => ({
  useSidebar: () => ({ isOpen: false, open: jest.fn(), close: jest.fn() }),
}));
jest.mock("@/components/GlobalSearch", () => ({ __esModule: true, default: () => null }));

const chip = () =>
  screen.getByRole("button", {
    name: /changes waiting to sync|syncing your saved changes|^connected$|^offline$/i,
  });

const renderTopBar = () =>
  render(
    <ToastProvider>
      <TopBar pageTitle="Fees" onSignOut={jest.fn()} />
    </ToastProvider>,
  );

/**
 * The store is a module singleton, so it outlives a single test. The queue
 * announces itself with an event, and that is exactly how a real write wakes
 * the store up, so the tests use the same door.
 */
const refreshQueue = async () => {
  await act(async () => {
    window.dispatchEvent(new Event("skoolmate:sync-queue-changed"));
  });
};

beforeEach(() => {
  queue.pending = 0;
  push.mockClear();
  syncToServer.mockClear();
});

describe("the sync chip", () => {
  it("shows how many changes are waiting to reach the server", async () => {
    queue.pending = 3;
    renderTopBar();
    await refreshQueue();

    await waitFor(() =>
      expect(chip()).toHaveAttribute("aria-label", expect.stringContaining("3 changes waiting to sync")),
    );
    expect(chip()).toHaveTextContent("3");
  });

  it("updates the moment a write is queued, without waiting for a poll", async () => {
    renderTopBar();
    await refreshQueue();

    await waitFor(() => expect(chip()).toHaveAttribute("aria-label", "Connected"));

    queue.pending = 2;
    await refreshQueue();

    await waitFor(() => expect(chip()).toHaveTextContent("2"));
  });

  it("pushes the queue when the teacher taps it and there is a connection", async () => {
    queue.pending = 2;
    renderTopBar();
    await refreshQueue();

    await waitFor(() => expect(chip()).toHaveTextContent("2"));

    await act(async () => {
      fireEvent.click(chip());
    });

    expect(syncToServer).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText(/Synced 2 changes/i)).toBeInTheDocument());
  });

  it("sends the teacher to Sync Center when there is nothing to push", async () => {
    renderTopBar();
    await refreshQueue();

    await waitFor(() => expect(chip()).toHaveAttribute("aria-label", "Connected"));

    await act(async () => {
      fireEvent.click(chip());
    });

    expect(push).toHaveBeenCalledWith("/dashboard/sync-center");
  });
});
