import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FilterBar, Pagination } from "@/components/ui/FilterBar";
import SearchField from "@/components/ui/SearchField";
import { searchReportList } from "@/lib/report-list";

describe("shared search and filters", () => {
  it("labels search, clears it, and returns focus to the input", () => {
    function SearchExample() {
      const [value, setValue] = useState("Mary");
      return <SearchField label="Search students" value={value} onChange={setValue} />;
    }
    render(<SearchExample />);
    const input = screen.getByRole("searchbox", { name: "Search students" });
    fireEvent.click(screen.getByRole("button", { name: "Clear search students" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search students" })).not.toBeInTheDocument();
  });

  it("offers clear all for a single filter and announces empty results", () => {
    const clear = jest.fn();
    const remove = jest.fn();
    render(
      <FilterBar
        chips={[{ key: "status", label: "Status", value: "draft", display: "Draft" }]}
        onRemoveChip={remove}
        onClearAll={clear}
        resultCount={0}
        totalCount={20}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Showing 0 of 20");
    fireEvent.click(screen.getByRole("button", { name: "Remove Status filter" }));
    expect(remove).toHaveBeenCalledWith("status");
    fireEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("shows a valid range and disables paging when all rows are selected", () => {
    render(<Pagination page={1} totalPages={1} pageSize={-1} totalCount={34} onPageChange={jest.fn()} />);
    expect(screen.getByRole("navigation", { name: "Pagination" })).toHaveTextContent("1-34 of 34 · Page 1 of 1");
    expect(screen.getByRole("button", { name: "Prev" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});

describe("report card search", () => {
  const reports = [
    { name: "Brian Ochen", studentNumber: "SM-001" },
    { name: "Mary Akello", studentNumber: "SM-002" },
  ];
  it("finds generated cards by name and student number without changing the source", () => {
    expect(searchReportList(reports, "  BRIAN  ")).toEqual([reports[0]]);
    expect(searchReportList(reports, "sm-002")).toEqual([reports[1]]);
    expect(reports).toHaveLength(2);
  });
  it("restores all cards on clearing search and returns an empty list for no matches", () => {
    expect(searchReportList(reports, "   ")).toEqual(reports);
    expect(searchReportList(reports, "no matching learner")).toEqual([]);
  });
});
