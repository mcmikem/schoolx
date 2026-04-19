"use client";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_NOTICES } from "@/lib/demo-data";
import { getErrorMessage } from "@/lib/validation";

export default function NoticesPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const toastRef = useRef(toast);
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "General",
    send_sms: false,
  });

  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const fetchNotices = useCallback(async () => {
    if (isDemo) {
      setNotices(DEMO_NOTICES);
      setLoading(false);
      return;
    }
    if (!school?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotices(data || []);
    } catch {
      toastRef.current.error("Failed to load notices");
    } finally {
      setLoading(false);
    }
  }, [school?.id, isDemo]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this notice?")) return;
    setDeletingId(id);
    try {
      if (isDemo) {
        setNotices((prev) => prev.filter((n) => n.id !== id));
      } else {
        const { error } = await supabase.from("notices").delete().eq("id", id);
        if (error) throw error;
        setNotices((prev) => prev.filter((n) => n.id !== id));
      }
      toast.success("Notice deleted");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to delete notice"));
    } finally {
      setDeletingId(null);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    if (form.title.trim().length > 200) {
      toast.error("Title is too long");
      return;
    }

    setPosting(true);
    try {
      if (isDemo) {
        // Demo mode – local state only
        setNotices((previous) => [
          {
            id: `notice-${Date.now()}`,
            title: form.title.trim(),
            content: form.content.trim(),
            type: form.category,
            category: form.category,
            priority: form.category === "Emergency" ? "high" : "normal",
            published_by: user?.id,
            created_at: new Date().toISOString(),
            is_published: true,
          },
          ...previous,
        ]);
      } else {
        const { error } = await supabase.from("notices").insert({
          school_id: school!.id,
          title: form.title.trim(),
          content: form.content.trim(),
          type: form.category,
          priority: form.category === "Emergency" ? "high" : "normal",
          published_by: user?.id,
          publish_date: new Date().toISOString(),
          is_published: true,
        });
        if (error) throw error;
        await fetchNotices();
      }
      setShowPostModal(false);
      setForm({ title: "", content: "", category: "General", send_sms: false });
      toast.success("Notice posted successfully");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, "Failed to post notice"));
    } finally {
      setPosting(false);
    }
  };

  return (
    <PageErrorBoundary>
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <PageHeader
        title="Notices"
        subtitle="Post and manage school notices"
        actions={
          <Button onClick={() => setShowPostModal(true)}>
            <MaterialIcon icon="add" />
            Post Notice
          </Button>
        }
      />

      {loading ? (
        <div className="text-center py-12 text-gray-400">
          Loading notices...
        </div>
      ) : notices.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MaterialIcon icon="campaign" className="text-4xl mx-auto mb-2" />
          <p>No notices posted yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notices.map((notice) => (
            <Card key={notice.id}>
              <CardBody>
                <h2 className="text-lg font-semibold">{notice.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{notice.content}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                    {notice.type || notice.category || "General"}
                  </span>
                  {notice.priority === "high" && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                      Urgent
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => handleDelete(notice.id)}
                    disabled={deletingId === notice.id}
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
                    title="Delete notice"
                  >
                    <MaterialIcon icon="delete" className="text-sm" />
                    {deletingId === notice.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {showPostModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Post Notice</h2>
            <form onSubmit={handlePost}>
              <div className="space-y-4">
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="title"
                  >
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    className="input w-full"
                    required
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="category"
                  >
                    Category
                  </label>
                  <select
                    id="category"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option value="General">General</option>
                    <option value="Academic">Academic</option>
                    <option value="Event">Event</option>
                    <option value="Emergency">Emergency</option>
                  </select>
                </div>
                <div>
                  <label
                    className="text-sm font-medium mb-1 block"
                    htmlFor="content"
                  >
                    Content
                  </label>
                  <textarea
                    id="content"
                    value={form.content}
                    onChange={(e) =>
                      setForm({ ...form, content: e.target.value })
                    }
                    className="input w-full min-h-[120px]"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowPostModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={posting} className="flex-1">
                    {posting ? "Posting..." : "Post Notice"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </PageErrorBoundary>
  );
}
