"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_NOTICES } from "@/lib/demo-data";

export default function NoticesPage() {
  const { user, school, isDemo } = useAuth();
  const toast = useToast();
  const [notices, setNotices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "General",
    send_sms: false,
  });

  const fetchNotices = useCallback(async () => {
    if (!school?.id) {
      setNotices([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (isDemo) {
        setNotices(DEMO_NOTICES.filter((n) => n.school_id === school.id));
        return;
      }

      const { data, error } = await supabase
        .from("notices")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotices(data || []);
    } catch (error) {
      toast.error("Failed to load notices");
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, [isDemo, school?.id, toast]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!school?.id || !user?.id) return;

    setPosting(true);
    try {
      if (isDemo) {
        const newNotice = {
          id: `notice-${Date.now()}`,
          school_id: school.id,
          title: form.title,
          content: form.content,
          type: form.category.toLowerCase(),
          priority: form.category === "Emergency" ? "high" : "normal",
          created_at: new Date().toISOString(),
        };
        setNotices((prev) => [newNotice, ...prev]);
      } else {
        const { error } = await supabase.from("notices").insert({
          school_id: school.id,
          title: form.title,
          content: form.content,
          type: form.category.toLowerCase(),
          priority: form.category === "Emergency" ? "high" : "normal",
          published_by: user.id,
          publish_date: new Date().toISOString(),
          is_published: true,
        });
        if (error) throw error;
        await fetchNotices();
      }

      setShowPostModal(false);
      setForm({ title: "", content: "", category: "General", send_sms: false });
      toast.success("Notice posted successfully");
    } catch {
      toast.error("Failed to post notice");
    } finally {
      setPosting(false);
    }
  };

  return (
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
        <div className="text-center py-12 text-gray-400">Loading notices...</div>
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
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {notice.type || notice.category || "General"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(
                      notice.created_at || notice.publish_date || Date.now(),
                    ).toLocaleDateString()}
                  </span>
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
                  <label className="text-sm font-medium mb-1 block" htmlFor="title">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
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
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input w-full"
                  >
                    <option>General</option>
                    <option>Academic</option>
                    <option>Event</option>
                    <option>Emergency</option>
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
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
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
  );
}
