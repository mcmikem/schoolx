"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";

const CATEGORIES = ["All", "Textbooks", "Fiction", "Science", "History", "Reference", "Religious"];

export default function LibraryPage() {
  const { school } = useAuth();
  const [books, setBooks] = useState<any[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "Textbooks", total_copies: "1" });
  const [saving, setSaving] = useState(false);

  // Demo data
  const demoBooks = [
    { id: "1", title: "Mathematics for S4", author: "Uganda MoES", isbn: "978-000-001", category: "Textbooks", total_copies: 40, available_copies: 28, borrowed: 12 },
    { id: "2", title: "Biology Today", author: "MK Publishers", isbn: "978-000-002", category: "Textbooks", total_copies: 30, available_copies: 30, borrowed: 0 },
    { id: "3", title: "Things Fall Apart", author: "Chinua Achebe", isbn: "978-000-003", category: "Fiction", total_copies: 15, available_copies: 9, borrowed: 6 },
    { id: "4", title: "Uganda History Vol.1", author: "Dept. of History", isbn: "978-000-004", category: "History", total_copies: 20, available_copies: 17, borrowed: 3 },
    { id: "5", title: "Introduction to Physics", author: "SESEMAT", isbn: "978-000-005", category: "Science", total_copies: 25, available_copies: 20, borrowed: 5 },
  ];

  useEffect(() => {
    setLoading(true);
    setTimeout(() => { setBooks(demoBooks); setLoading(false); }, 500);
  }, [school?.id]);

  const filtered = books.filter((b) =>
    (category === "All" || b.category === category) &&
    (b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase()))
  );

  const totalBooks = books.reduce((s, b) => s + b.total_copies, 0);
  const totalBorrowed = books.reduce((s, b) => s + b.borrowed, 0);
  const overdue = 3; // mock

  const saveBook = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setBooks([...books, { ...form, id: Date.now().toString(), total_copies: parseInt(form.total_copies), available_copies: parseInt(form.total_copies), borrowed: 0 }]);
    setForm({ title: "", author: "", isbn: "", category: "Textbooks", total_copies: "1" });
    setShowAdd(false);
    setSaving(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MaterialIcon icon="local_library" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Library</h1>
          </div>
          <p className="text-slate-500 font-medium">Book catalogue, borrowing, and inventory</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search books or authors..." className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 min-w-[280px]" />
            <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-indigo-600/20">
            <MaterialIcon icon="add" /> Add Book
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Volumes", value: totalBooks, icon: "auto_stories", color: "bg-indigo-600" },
          { label: "Currently Borrowed", value: totalBorrowed, icon: "bookmark", color: "bg-blue-500" },
          { label: "Available Now", value: totalBooks - totalBorrowed, icon: "check_circle", color: "bg-emerald-500" },
          { label: "Overdue Returns", value: overdue, icon: "schedule", color: "bg-red-500" },
        ].map((s) => (
          <div key={s.label} className="p-5 bg-white rounded-3xl border border-slate-100 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${s.color} text-white flex items-center justify-center shrink-0`}>
              <MaterialIcon icon={s.icon} />
            </div>
            <div>
              <p className="text-2xl font-black text-slate-800">{s.value}</p>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${category === c ? "bg-indigo-600 text-white shadow-lg" : "bg-white text-slate-500 border border-slate-100 hover:border-slate-200"}`}>{c}</button>
        ))}
      </div>

      {/* Book Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-100 rounded-3xl animate-pulse" />)
          : filtered.map((book) => {
              const pct = Math.round((book.available_copies / book.total_copies) * 100);
              return (
                <div key={book.id} className="bg-white p-6 rounded-3xl border border-slate-100 hover:shadow-lg transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">{book.category}</span>
                    <span className={`text-[10px] font-black ${book.available_copies === 0 ? "text-red-500" : "text-emerald-600"}`}>{book.available_copies === 0 ? "OUT" : `${book.available_copies} left`}</span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">{book.title}</h3>
                  <p className="text-xs text-slate-400 font-medium mb-4">{book.author}</p>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mb-2">
                    <div className={`h-full rounded-full transition-all ${pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>{book.available_copies}/{book.total_copies} available</span>
                    <span>{book.borrowed} borrowed</span>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Add Book Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[40px] w-full max-w-md shadow-2xl p-8">
            <div className="flex justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-800">Add Book</h2>
              <button onClick={() => setShowAdd(false)} className="p-2 hover:bg-slate-100 rounded-xl"><MaterialIcon icon="close" className="text-slate-400" /></button>
            </div>
            <div className="space-y-5">
              {(["title", "author", "isbn"] as const).map((f) => (
                <div key={f}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{f}</label>
                  <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none">
                    {CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Copies</label>
                  <input type="number" min="1" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none" />
                </div>
              </div>
              <button onClick={saveBook} disabled={!form.title || saving} className="w-full py-4 bg-indigo-600 text-white rounded-[28px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MaterialIcon icon="save" /> Save Book</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}