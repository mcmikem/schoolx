"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { useTablePreferences } from "@/lib/useTablePreferences";
import { Modal } from "@/components/ui/Modal";

interface RegistryTabProps {
  students: any[];
  classes: any[];
  loading: boolean;
  onEdit: (student: any) => void;
  onDelete: (id: string) => void;
  onSendSMS: (student: any) => void;
  houses: any[];
}

export default function RegistryTab({
  students,
  classes,
  loading,
  onEdit,
  onDelete,
  onSendSMS,
  houses
}: RegistryTabProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("all");
  const [filterGender, setFilterGender] = useState<"all" | "M" | "F">("all");
  const [sortBy, setSortBy] = useState<"name" | "number" | "class">("name");
  
  const { preferences: tablePrefs, updatePreferences: updateTablePrefs } = useTablePreferences("students-registry");
  const pageSize = tablePrefs.pageSize || 50;
  const [currentPage, setCurrentPage] = useState(1);

  const filtered = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let result = students.filter((s) => {
      const name = `${s.first_name} ${s.last_name}`.toLowerCase();
      const matchesSearch = !normalizedSearch || 
        name.includes(normalizedSearch) || 
        s.parent_name?.toLowerCase().includes(normalizedSearch) ||
        s.student_number?.toLowerCase().includes(normalizedSearch);
      const matchesClass = selectedClass === "all" || s.class_id === selectedClass;
      const matchesGender = filterGender === "all" || s.gender === filterGender;
      return matchesSearch && matchesClass && matchesGender;
    });

    result.sort((a, b) => {
      if (sortBy === "name") return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
      if (sortBy === "number") return (a.student_number || "").localeCompare(b.student_number || "");
      return (a.classes?.name || "").localeCompare(b.classes?.name || "");
    });

    return result;
  }, [students, searchTerm, selectedClass, filterGender, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedStudents = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, selectedClass, filterGender, sortBy, pageSize]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-end lg:items-center bg-[var(--surface-container-low)] p-4 rounded-2xl border border-[var(--border)]">
        <div className="flex-1 relative w-full">
          <MaterialIcon icon="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t3)]" />
          <input
            type="text"
            placeholder="Search by name, number or parent..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
            <option value="all">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterGender} onChange={(e) => setFilterGender(e.target.value as any)} className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
            <option value="all">Gender</option>
            <option value="M">Boys</option>
            <option value="F">Girls</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm">
            <option value="name">Sort: Name</option>
            <option value="number">Sort: ID</option>
            <option value="class">Sort: Class</option>
          </select>
        </div>
      </div>

      {loading ? (
        <TableSkeleton rows={10} />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
           <MaterialIcon icon="person_search" className="text-5xl text-gray-200 mb-4" />
           <h3 className="font-bold text-gray-500">No students found</h3>
           <p className="text-sm text-gray-400">Try adjusting your filters or search term</p>
        </Card>
      ) : (
        <>
          <Card className="overflow-hidden border-[var(--border)]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--surface-container)] border-b border-[var(--border)]">
                    <th className="p-4 text-left text-[11px] font-black uppercase tracking-wider text-[var(--t3)]">Student</th>
                    <th className="p-4 text-left text-[11px] font-black uppercase tracking-wider text-[var(--t3)]">Class</th>
                    <th className="p-4 text-left text-[11px] font-black uppercase tracking-wider text-[var(--t3)]">Parent Info</th>
                    <th className="p-4 text-left text-[11px] font-black uppercase tracking-wider text-[var(--t3)]">Status</th>
                    <th className="p-4 text-right text-[11px] font-black uppercase tracking-wider text-[var(--t3)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((s) => (
                    <tr key={s.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-container-low)] transition-colors group">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-white ${s.gender === 'M' ? 'bg-navy' : 'bg-rose-500'}`}>
                            {s.first_name[0]}{s.last_name[0]}
                          </div>
                          <div>
                            <div className="font-bold text-[var(--on-surface)]">{s.first_name} {s.last_name}</div>
                            <div className="text-[10px] font-black uppercase text-[var(--t3)] tracking-tighter">{s.student_number || 'NO ID'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-semibold text-[var(--on-surface)]">{s.classes?.name || '-'}</div>
                        <div className="text-[10px] text-[var(--t3)]">{s.classes?.level || ''}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm font-medium">{s.parent_name || '-'}</div>
                        <div className="text-xs text-blue-600 font-mono">{s.parent_phone || ''}</div>
                      </td>
                      <td className="p-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${s.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(s)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Edit"><MaterialIcon icon="edit" className="text-lg" /></button>
                          <button onClick={() => onSendSMS(s)} className="p-2 hover:bg-emerald-50 text-emerald-600 rounded-lg" title="SMS"><MaterialIcon icon="sms" className="text-lg" /></button>
                          <button onClick={() => onDelete(s.id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg" title="Delete"><MaterialIcon icon="delete" className="text-lg" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          <div className="flex items-center justify-between p-4 bg-[var(--surface-container-low)] rounded-xl border border-[var(--border)]">
             <div className="text-xs font-bold text-[var(--t3)]">
               Showing {Math.min(filtered.length, (currentPage - 1) * pageSize + 1)} to {Math.min(filtered.length, currentPage * pageSize)} of {filtered.length}
             </div>
             <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                <div className="flex items-center gap-1">
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const page = i + 1;
                    return (
                      <button key={page} onClick={() => setCurrentPage(page)} className={`w-8 h-8 rounded-lg text-xs font-bold ${currentPage === page ? 'bg-navy text-white' : 'hover:bg-white text-[var(--t3)]'}`}>
                        {page}
                      </button>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
             </div>
          </div>
        </>
      )}
    </div>
  );
}
