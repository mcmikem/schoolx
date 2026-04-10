"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import MaterialIcon from "@/components/MaterialIcon";
import { cardClassName } from "@/lib/utils";
import { useToast } from "@/components/Toast";

const CATEGORIES = ["All", "Textbooks", "Fiction", "Science", "History", "Reference", "Religious"];

export default function LibraryPage() {
  const { school } = useAuth();
  const toast = useToast();
  const [books, setBooks] = useState<any[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: "", author: "", isbn: "", category: "Textbooks", total_copies: "1" });
  const [saving, setSaving] = useState(false);

  const fetchBooks = useCallback(async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("library_books")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    
    if (!error) setBooks(data || []);
    setLoading(false);
  }, [school?.id]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const filtered = books.filter((b) =>
    (category === "All" || b.category === category) &&
    (b.title.toLowerCase().includes(search.toLowerCase()) || (b.author?.toLowerCase() || "").includes(search.toLowerCase()))
  );

  const totalBooks = books.reduce((s, b) => s + Number(b.total_copies || 0), 0);
  const availableBooks = books.reduce((s, b) => s + Number(b.available_copies || 0), 0);
  const totalBorrowed = totalBooks - availableBooks;

  const saveBook = async () => {
    if (!school?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("library_books").insert({
        school_id: school.id,
        title: form.title,
        author: form.author,
        isbn: form.isbn,
        category: form.category,
        total_copies: parseInt(form.total_copies),
        available_copies: parseInt(form.total_copies)
      });

      if (error) throw error;
      
      toast.success("Book added to catalogue");
      fetchBooks();
      setForm({ title: "", author: "", isbn: "", category: "Textbooks", total_copies: "1" });
      setShowAdd(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to add book");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MaterialIcon icon="local_library" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Library Core</h1>
          </div>
          <p className="text-slate-500 font-medium">Manage book inventory and student borrowing</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalogue..." className="pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 min-w-[280px]" />
            <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:scale-105 transition-all shadow-lg shadow-indigo-600/20">
            <MaterialIcon icon="add" /> New Volume
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Stock", value: totalBooks, icon: "auto_stories", color: "bg-indigo-600" },
          { label: "On Loan", value: totalBorrowed, icon: "bookmark", color: "bg-blue-500" },
          { label: "In Library", value: availableBooks, icon: "check_circle", color: "bg-emerald-500" },
          { label: "Inventory Value", value: books.length, icon: "inventory_2", color: "bg-amber-600" },
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
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setCategory(c)} className={`px-5 py-2 rounded-2xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all ${category === c ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "bg-white text-slate-500 border border-slate-100 hover:border-slate-200"}`}>{c}</button>
        ))}
      </div>

      {/* Book Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-slate-50 rounded-3xl animate-pulse" />)
          : filtered.map((book) => {
              const pct = book.total_copies > 0 ? Math.round((book.available_copies / book.total_copies) * 100) : 0;
              return (
                <div key={book.id} className="bg-white p-6 rounded-3xl border border-slate-100 hover:shadow-xl transition-all group relative overflow-hidden">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-black uppercase tracking-wider">{book.category}</span>
                    <span className={`text-[10px] font-black ${book.available_copies === 0 ? "text-red-500" : "text-emerald-600"}`}>
                        {book.available_copies === 0 ? "OUT OF STOCK" : `${book.available_copies} AVAILABLE`}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{book.title}</h3>
                  <p className="text-xs text-slate-400 font-bold mb-4 italic">by {book.author || "Unknown Author"}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest">
                        <span>STOCK STATUS</span>
                        <span>{pct}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${pct > 50 ? "bg-emerald-400" : pct > 20 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <div className="flex flex-col">
                            <span className="text-lg font-black text-slate-800 leading-none">{book.available_copies}</span>
                            <span className="text-[8px] font-black text-slate-400">IN SHELF</span>
                        </div>
                        <button className="p-2 bg-slate-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all">
                            <MaterialIcon icon="arrow_forward" style={{ fontSize: 18 }} />
                        </button>
                    </div>
                  </div>
                </div>
              );
            })
        }
      </div>

      {/* Add Book Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl p-8 transform animate-in slide-in-from-bottom-8 duration-300">
            <div className="flex justify-between mb-8 items-center">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Add Volume</h2>
              <button onClick={() => setShowAdd(false)} className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-2xl transition-colors"><MaterialIcon icon="close" className="text-slate-400" /></button>
            </div>
            <div className="space-y-5">
              {(["title", "author", "isbn"] as const).map((f) => (
                <div key={f}>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">{f}</label>
                  <input value={form[f]} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-300" placeholder={`Enter ${f}...`} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100">
                    {CATEGORIES.slice(1).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">Total Copies</label>
                  <input type="number" min="1" value={form.total_copies} onChange={(e) => setForm({ ...form, total_copies: e.target.value })} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-100" />
                </div>
              </div>
              <button onClick={saveBook} disabled={!form.title || saving} className="w-full py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black uppercase tracking-widest hover:shadow-xl hover:shadow-indigo-600/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                {saving ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><MaterialIcon icon="save" /> Register Volume</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}