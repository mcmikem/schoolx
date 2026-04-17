"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";
import { DEMO_NOTICES, DEMO_STAFF } from "@/lib/demo-data";

const DEMO_MODE_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES === "true";

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

  useEffect(() => {
    if (DEMO_MODE_ENABLED && isDemo) {
      setNotices(DEMO_NOTICES);
    }
    setLoading(false);
  }, [isDemo]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    const newNotice = {
      id: `notice-${Date.now()}`,
      title: form.title,
      content: form.content,
      category: form.category,
      priority: form.category === "Emergency" ? "high" : "normal",
      created_by: user?.id,
      created_at: new Date().toISOString(),
      send_sms: form.send_sms,
    };
    setNotices([newNotice, ...notices]);
    setShowPostModal(false);
    setForm({ title: "", content: "", category: "General", send_sms: false });
    toast.success("Notice posted successfully");
    setPosting(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {!DEMO_MODE_ENABLED && (
        <Card className="mb-6">
          <CardBody className="p-6">
            <p className="text-sm text-[var(--t2)]">
              Notices are temporarily unavailable in this production build while
              the workflow is being completed.
            </p>
          </CardBody>
        </Card>
      )}
      <PageHeader
        title="Notices"
        subtitle="Post and manage school notices"
        actions={
          <Button
            onClick={() => setShowPostModal(true)}
            disabled={!DEMO_MODE_ENABLED || !isDemo}
          >
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
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                    {notice.category}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(notice.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {DEMO_MODE_ENABLED && isDemo && showPostModal && (
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
  );
}
