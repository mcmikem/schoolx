"use client";

import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { useToast } from "@/components/Toast";
import { getErrorMessage } from "@/lib/validation";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { isClassScopedRole } from "@/lib/roles";
import { Button, Modal, StatStrip } from "@/components/ui/index";
import { PageHeader } from "@/components/ui/PageHeader";
import SearchField from "@/components/ui/SearchField";
import { EmptyState } from "@/components/EmptyState";

const CATEGORIES = ["All", "Textbooks", "Fiction", "Science", "History", "Reference", "Religious"];
const BLANK_FORM = { title: "", author: "", isbn: "", category: "Textbooks", total_copies: "1" };

interface LibraryBook {
  id: string;
  title: string;
  author?: string | null;
  isbn?: string | null;
  category?: string | null;
  total_copies: number;
  available_copies: number;
  created_at?: string | null;
}

export default function LibraryPage() {
  const { school, user } = useAuth();
  const canManageCatalog = !isClassScopedRole(user?.role);
  const toast = useToast();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingBook, setEditingBook] = useState<LibraryBook | null>(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LibraryBook | null>(null);
  const [deleting, setDeleting] = useState(false);

  const parsedCopies = parseInt(form.total_copies, 10);
  const libraryValidationError =
    !form.title.trim() || !form.author.trim()
      ? "Add both title and author to continue."
      : !Number.isFinite(parsedCopies) || parsedCopies < 1
        ? "Total copies must be at least 1."
        : "";

  const fetchBooks = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });

    if (!error) setBooks((data || []) as LibraryBook[]);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const needle = search.trim().toLowerCase();
  const filtered = books.filter(
    (book) =>
      (category === "All" || book.category === category) &&
      (!needle ||
        book.title.toLowerCase().includes(needle) ||
        (book.author?.toLowerCase() || "").includes(needle) ||
        (book.isbn?.toLowerCase() || "").includes(needle)),
  );

  const totalBooks = books.reduce((sum, book) => sum + Number(book.total_copies || 0), 0);
  const availableBooks = books.reduce((sum, book) => sum + Number(book.available_copies || 0), 0);
  const totalBorrowed = totalBooks - availableBooks;

  const closeAdd = () => {
    setShowAdd(false);
    setEditingBook(null);
    setForm(BLANK_FORM);
  };

  const saveBook = async () => {
    if (!school?.id) return;
    if (libraryValidationError) {
      toast.error(libraryValidationError);
      return;
    }

    const totalCopies = parsedCopies;

    setSaving(true);
    try {
      if (editingBook) {
        // Edit existing book
        const { error } = await supabase
          .from("library_books")
          .update({
            title: form.title.trim(),
            author: form.author.trim(),
            isbn: form.isbn.trim(),
            category: form.category,
            total_copies: totalCopies,
            // Adjust available_copies by the delta in total_copies
            available_copies: Math.max(
              0,
              (editingBook.available_copies || 0) + (totalCopies - editingBook.total_copies),
            ),
          })
          .eq("id", editingBook.id);
        if (error) throw error;
        toast.success("Book updated");
      } else {
        // Add new book
        if (form.isbn.trim()) {
          const { data: dup } = await supabase
            .from("library_books")
            .select("id")
            .eq("school_id", school.id)
            .eq("isbn", form.isbn.trim())
            .maybeSingle();
          if (dup) throw new Error("A book with this ISBN already exists");
        }
        const result = await withTimeout(
          supabase.from("library_books").insert({
            school_id: school.id,
            title: form.title.trim(),
            author: form.author.trim(),
            isbn: form.isbn.trim(),
            category: form.category,
            total_copies: totalCopies,
            available_copies: totalCopies,
          }),
          15000,
          timeoutFallback(),
        );
        if (result?.error) throw result.error;
        toast.success("Book added to catalogue");
      }

      fetchBooks();
      closeAdd();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, "Failed to save book"));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (book: LibraryBook) => {
    setEditingBook(book);
    setForm({
      title: book.title,
      author: book.author || "",
      isbn: book.isbn || "",
      category: book.category || "Textbooks",
      total_copies: String(book.total_copies || 1),
    });
    setShowAdd(true);
  };

  const handleDeleteConfirm = (book: LibraryBook) => {
    setPendingDelete(book);
    setConfirmOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("library_books").delete().eq("id", pendingDelete.id);
      if (error) throw error;
      setBooks((prev) => prev.filter((book) => book.id !== pendingDelete.id));
      toast.success("Book removed from catalogue");
      setConfirmOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete book"));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("All");
  };

  return (
    <PageErrorBoundary>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <PageHeader
          title="Library"
          subtitle={
            loading
              ? "Loading the catalogue"
              : `${books.length} title${books.length === 1 ? "" : "s"} · ${availableBooks} of ${totalBooks} copies on the shelf`
          }
          actions={
            canManageCatalog && (
              <Button onClick={() => setShowAdd(true)} icon={<MaterialIcon icon="add" />}>
                New volume
              </Button>
            )
          }
        />

        <StatStrip
          columns={4}
          items={[
            { label: "Titles", value: books.length, hint: "in the catalogue", tone: "info" },
            { label: "Total stock", value: totalBooks, hint: "copies owned" },
            {
              label: "On loan",
              value: totalBorrowed,
              hint: "with students",
              tone: totalBorrowed > 0 ? "warning" : "default",
            },
            { label: "In library", value: availableBooks, hint: "ready to borrow", tone: "positive" },
          ]}
        />

        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--sh1)] sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <SearchField
              label="Search catalogue"
              value={search}
              onChange={setSearch}
              placeholder="Title, author or ISBN"
            />
            <div className="no-scrollbar flex shrink-0 gap-2 overflow-x-auto pb-1 lg:pb-0">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={`min-h-10 shrink-0 whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors ${
                    category === item
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--surface-container-low)] text-[var(--t2)] hover:bg-[var(--surface-container)]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          {(needle || category !== "All") && (
            <p className="text-xs text-[var(--t3)]">
              {filtered.length} of {books.length} titles
              {category !== "All" ? ` in ${category}` : ""}
              {needle ? ` matching “${search.trim()}”` : ""}
            </p>
          )}
        </div>

        {loading ? (
          <div
            role="status"
            aria-label="Loading catalogue"
            aria-live="polite"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl bg-[var(--surface-container-low)]" />
            ))}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            icon="auto_stories"
            title="No books yet"
            description="Add the titles on your shelves, then track how many copies are available to borrow."
            action={canManageCatalog ? { label: "Add your first book", onClick: () => setShowAdd(true) } : undefined}
            owlyQuestion="How do I add books to the library catalogue?"
          />
        ) : filtered.length === 0 ? (
          <div
            role="status"
            className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-12 text-center"
          >
            <MaterialIcon icon="search_off" className="text-3xl text-[var(--t3)]" />
            <h2 className="mt-2 font-semibold text-[var(--t1)]">No books found</h2>
            <p className="mt-1 text-sm text-[var(--t3)]">
              {category !== "All" && needle
                ? `Nothing in ${category} matches “${search.trim()}”.`
                : category !== "All"
                  ? `No books in the “${category}” category.`
                  : `Nothing matches “${search.trim()}”.`}
            </p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((book) => {
              const total = Number(book.total_copies || 0);
              const available = Number(book.available_copies || 0);
              const pct = total > 0 ? Math.round((available / total) * 100) : 0;
              const barTone = pct > 50 ? "bg-[var(--green)]" : pct > 20 ? "bg-[var(--amber)]" : "bg-[var(--error)]";

              return (
                <article
                  key={book.id}
                  className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--sh1)] transition-shadow hover:shadow-[var(--sh2)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="rounded-full bg-[var(--primary-50)] px-2.5 py-1 text-xs font-semibold text-[var(--primary-700)]">
                      {book.category || "Uncategorised"}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        available === 0
                          ? "bg-[var(--red-soft)] text-[var(--red-ink)]"
                          : "bg-[var(--green-soft)] text-[var(--green-ink)]"
                      }`}
                    >
                      {available === 0 ? "Out of stock" : `${available} available`}
                    </span>
                  </div>

                  <h3 className="mt-3 text-base font-semibold text-[var(--t1)]">{book.title}</h3>
                  <p className="mt-1 text-sm text-[var(--t3)]">by {book.author || "Unknown author"}</p>

                  <div className="mt-auto space-y-2 pt-4">
                    <div className="flex items-center justify-between text-xs text-[var(--t3)]">
                      <span>On shelf</span>
                      <span className="font-semibold text-[var(--t2)]">
                        {available} of {total}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`${book.title} availability`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={pct}
                      className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-container-low)]"
                    >
                      <div className={`h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-2">
                      <span className="truncate text-xs text-[var(--t3)]">
                        {book.isbn ? `ISBN ${book.isbn}` : "No ISBN"}
                      </span>
                      {canManageCatalog && (
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(book)}
                            aria-label={`Edit ${book.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--t3)] transition-colors hover:bg-[var(--surface-container)] hover:text-[var(--primary)]"
                          >
                            <MaterialIcon icon="edit" className="text-lg" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirm(book)}
                            aria-label={`Remove ${book.title}`}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--t3)] transition-colors hover:bg-[var(--red-soft)] hover:text-[var(--red-ink)]"
                          >
                            <MaterialIcon icon="delete" className="text-lg" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <Modal isOpen={showAdd} onClose={closeAdd} title={editingBook ? "Edit volume" : "Add volume"} size="md">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveBook();
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="library-title" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                Title *
              </label>
              <input
                id="library-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                className="input"
                placeholder="e.g. Fountain of Knowledge"
                required
              />
            </div>
            <div>
              <label htmlFor="library-author" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                Author *
              </label>
              <input
                id="library-author"
                value={form.author}
                onChange={(event) => setForm({ ...form, author: event.target.value })}
                className="input"
                placeholder="e.g. J. K. Rowling"
                required
              />
            </div>
            <div>
              <label htmlFor="library-isbn" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                ISBN
              </label>
              <input
                id="library-isbn"
                value={form.isbn}
                onChange={(event) => setForm({ ...form, isbn: event.target.value })}
                className="input"
                placeholder="Optional"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="library-category" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                  Category
                </label>
                <select
                  id="library-category"
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  className="input"
                >
                  {CATEGORIES.slice(1).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="library-copies" className="mb-2 block text-sm font-medium text-[var(--t2)]">
                  Total copies *
                </label>
                <input
                  id="library-copies"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={form.total_copies}
                  onChange={(event) => setForm({ ...form, total_copies: event.target.value })}
                  className="input"
                  required
                />
              </div>
            </div>
            {libraryValidationError && <p className="text-sm text-[var(--t3)]">{libraryValidationError}</p>}
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" fullWidth onClick={closeAdd}>
                Cancel
              </Button>
              <Button type="submit" fullWidth loading={saving} disabled={Boolean(libraryValidationError)}>
                {editingBook ? "Save changes" : "Add book"}
              </Button>
            </div>
          </form>
        </Modal>

        <ConfirmDialog
          isOpen={confirmOpen}
          title="Remove Book"
          message={pendingDelete ? `Remove "${pendingDelete.title}" from the catalogue? This cannot be undone.` : ""}
          confirmLabel={deleting ? "Removing…" : "Remove"}
          onConfirm={() => {
            handleDelete();
          }}
          onClose={() => {
            setConfirmOpen(false);
            setPendingDelete(null);
          }}
        />
      </div>
    </PageErrorBoundary>
  );
}
