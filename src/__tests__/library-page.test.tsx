import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import LibraryPage from "@/app/dashboard/library/page";

let mockBooks: Record<string, unknown>[] = [];

jest.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    school: { id: "school-1", name: "King's Academy" },
    user: { id: "admin-1", role: "school_admin" },
  }),
}));

jest.mock("@/components/Toast", () => ({
  useToast: () => ({ success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() }),
}));

jest.mock("@/components/ConfirmDialog", () => ({ ConfirmDialog: () => null }));

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const chain: Record<string, unknown> = {};
      for (const method of ["select", "eq", "order", "insert", "update", "delete"]) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
      chain.then = (resolve: (value: unknown) => unknown) => resolve({ data: mockBooks, error: null });
      return chain;
    },
  },
}));

jest.mock("@/components/ui/PageHeader", () => ({
  PageHeader: ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions}
    </div>
  ),
}));

const BOOKS = [
  {
    id: "book-1",
    title: "Fountain of Knowledge",
    author: "Okot p'Bitek",
    isbn: "978-9970-01-001-1",
    category: "Textbooks",
    total_copies: 5,
    available_copies: 3,
  },
  {
    id: "book-2",
    title: "Matilda",
    author: "Roald Dahl",
    isbn: "",
    category: "Fiction",
    total_copies: 2,
    available_copies: 0,
  },
];

describe("Library page", () => {
  beforeEach(() => {
    mockBooks = [...BOOKS];
  });

  it("renders the catalogue and stock summary", async () => {
    render(<LibraryPage />);

    expect(await screen.findByText("Fountain of Knowledge")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Library" })).toBeInTheDocument();

    expect(screen.getByText("Titles")).toBeInTheDocument();
    expect(screen.getByText("Total stock")).toBeInTheDocument();
    expect(screen.getByText("On loan")).toBeInTheDocument();
    expect(screen.getByText("In library")).toBeInTheDocument();
    expect(screen.getByText("Matilda")).toBeInTheDocument();
  });

  it("narrows by search and by category", async () => {
    render(<LibraryPage />);
    await screen.findByText("Fountain of Knowledge");

    fireEvent.change(screen.getByLabelText("Search catalogue"), { target: { value: "matilda" } });
    expect(screen.queryByText("Fountain of Knowledge")).not.toBeInTheDocument();
    expect(screen.getByText("Matilda")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search catalogue"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Fiction" }));
    expect(screen.queryByText("Fountain of Knowledge")).not.toBeInTheDocument();
    expect(screen.getByText("Matilda")).toBeInTheDocument();
  });

  it("shows an empty state that opens the add form", async () => {
    mockBooks = [];
    render(<LibraryPage />);

    expect(await screen.findByText("No books yet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /add your first book/i }));

    expect(screen.getByRole("dialog", { name: /add volume/i })).toBeInTheDocument();
  });

  it("requires a title and author in the add form", async () => {
    render(<LibraryPage />);
    await screen.findByText("Fountain of Knowledge");

    fireEvent.click(screen.getByRole("button", { name: /new volume/i }));

    expect(screen.getByLabelText("Title *")).toBeRequired();
    expect(screen.getByLabelText("Author *")).toBeRequired();
    expect(screen.getByLabelText("Total copies *")).toBeRequired();
    expect(screen.getByRole("button", { name: /add book/i })).toBeDisabled();
  });

  it("pre-fills the form when editing a book", async () => {
    render(<LibraryPage />);
    await screen.findByText("Fountain of Knowledge");

    fireEvent.click(screen.getByRole("button", { name: /edit fountain of knowledge/i }));

    const dialog = screen.getByRole("dialog", { name: /edit volume/i });
    expect(within(dialog).getByLabelText("Title *")).toHaveValue("Fountain of Knowledge");
    expect(within(dialog).getByLabelText("Author *")).toHaveValue("Okot p'Bitek");
    expect(within(dialog).getByLabelText("Total copies *")).toHaveValue(5);
  });

  it("reports availability on each book", async () => {
    render(<LibraryPage />);
    await screen.findByText("Fountain of Knowledge");

    expect(screen.getByRole("progressbar", { name: /fountain of knowledge availability/i })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });
});
