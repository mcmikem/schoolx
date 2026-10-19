import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { DataTable, type DataColumn } from "@/components/ui/DataTable";
import { StatStrip } from "@/components/ui/StatStrip";
import { ConflictResolver } from "@/components/ui/ConflictResolver";
import { useListState } from "@/lib/hooks/useListState";

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: "b", name: "Brenda", amount: 200 },
  { id: "a", name: "Asha", amount: 100 },
];

const columns: DataColumn<Row>[] = [
  { key: "name", header: "Name", sortValue: (row) => row.name, render: (row) => row.name },
  { key: "amount", header: "Amount", align: "right", render: (row) => row.amount },
];

describe("DataTable", () => {
  it("renders a table and a mobile card list for the same rows", () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(row) => row.id} caption="Pupils" />);
    expect(screen.getByRole("table", { name: "Pupils" })).toBeInTheDocument();
    expect(screen.getAllByText("Asha").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Brenda").length).toBeGreaterThanOrEqual(1);
  });

  it("sorts when a sortable header is clicked", () => {
    render(<DataTable columns={columns} rows={rows} getRowId={(row) => row.id} />);
    fireEvent.click(screen.getByRole("button", { name: /name/i }));
    const headers = screen.getAllByRole("columnheader");
    expect(headers[0]).toHaveAttribute("aria-sort", "ascending");
  });

  it("shows the empty slot when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} getRowId={(row) => row.id} empty={<p>Nothing here</p>} />);
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });
});

describe("StatStrip", () => {
  it("renders each label, value and hint", () => {
    render(
      <StatStrip
        items={[
          { label: "Waiting", value: 3, tone: "info", hint: "changes" },
          { label: "Failed", value: 1, tone: "negative" },
        ]}
      />,
    );
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("changes")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });
});

describe("ConflictResolver", () => {
  it("shows both versions and reports the chosen one", async () => {
    const keepLocal = jest.fn();
    const keepServer = jest.fn();
    render(
      <ConflictResolver
        title="students · Asha"
        local={{ name: "Asha Local", amount: 100 }}
        server={{ name: "Asha Server", amount: 100 }}
        onKeepLocal={keepLocal}
        onKeepServer={keepServer}
      />,
    );

    expect(screen.getByText("Asha Local")).toBeInTheDocument();
    expect(screen.getByText("Asha Server")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Keep my changes" }));
    await waitFor(() => expect(keepLocal).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Keep server version" }));
    await waitFor(() => expect(keepServer).toHaveBeenCalledTimes(1));
  });
});

describe("useListState", () => {
  beforeEach(() => window.history.replaceState(null, "", "/dashboard/students"));

  it("resets the page when the search changes and mirrors it into the URL", async () => {
    const { result } = renderHook(() => useListState({ pageSize: 20 }));
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setQ("asha"));
    expect(result.current.page).toBe(1);
    expect(result.current.q).toBe("asha");

    await waitFor(() => expect(window.location.search).toContain("q=asha"));
  });
});
