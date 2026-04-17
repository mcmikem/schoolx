"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import MaterialIcon from "@/components/MaterialIcon";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/index";

interface Suggestion {
  id: string;
  title: string;
  description: string;
  category: "feedback" | "feature" | "bug" | "general";
  status: "pending" | "reviewed" | "planned" | "completed";
  created_at: string;
  created_by_name?: string;
}

export default function SuggestionBoxPage() {
  const { user, school } = useAuth();
  const toast = useToast();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed">("all");

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "feedback" as "feedback" | "feature" | "bug" | "general",
  });

  const fetchSuggestions = async () => {
    if (!school?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("suggestions")
      .select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setSuggestions(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchSuggestions();
  }, [school?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.description) {
      toast.error("Please fill in all fields");
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from("suggestions").insert({
      school_id: school!.id,
      title: form.title,
      description: form.description,
      category: form.category,
      status: "pending",
      created_by: user!.id,
    });

    if (error) {
      toast.error("Failed to submit suggestion");
    } else {
      toast.success("Thank you for your feedback!");
      setShowModal(false);
      setForm({ title: "", description: "", category: "feedback" });
      fetchSuggestions();
    }
    setSubmitting(false);
  };

  const categories = [
    {
      id: "feedback",
      label: "Feedback",
      icon: "chat",
      desc: "Share your thoughts",
    },
    {
      id: "feature",
      label: "Feature Request",
      icon: "lightbulb",
      desc: "Suggest something new",
    },
    {
      id: "bug",
      label: "Report Issue",
      icon: "bug_report",
      desc: "Let us know what's broken",
    },
    {
      id: "general",
      label: "General",
      icon: "chat_bubble",
      desc: "Any other comment",
    },
  ];

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    reviewed: "bg-blue-100 text-blue-800",
    planned: "bg-purple-100 text-purple-800",
    completed: "bg-green-100 text-green-800",
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <PageHeader
        title="Suggestion Box"
        subtitle="Help us improve SkoolMate OS"
        actions={
          <Button
            onClick={() => setShowModal(true)}
            icon={<MaterialIcon icon="add" />}
          >
            Add Suggestion
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-600">
            {suggestions.filter((s) => s.status === "pending").length}
          </div>
          <div className="text-sm text-[var(--t3)]">Pending</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {suggestions.filter((s) => s.status === "reviewed").length}
          </div>
          <div className="text-sm text-[var(--t3)]">Reviewed</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {suggestions.filter((s) => s.status === "planned").length}
          </div>
          <div className="text-sm text-[var(--t3)]">Planned</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {suggestions.filter((s) => s.status === "completed").length}
          </div>
          <div className="text-sm text-[var(--t3)]">Completed</div>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(["all", "pending", "reviewed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              filter === f
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-container)] text-[var(--t2)] hover:bg-[var(--surface-container-high)]"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Suggestions List */}
      <div className="space-y-3">
        {suggestions
          .filter((s) => filter === "all" || s.status === filter)
          .map((suggestion) => (
            <Card
              key={suggestion.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardBody className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium uppercase tracking-wider text-[var(--t3)]">
                        {suggestion.category}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${statusColors[suggestion.status]}`}
                      >
                        {suggestion.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-[var(--on-surface)]">
                      {suggestion.title}
                    </h3>
                    <p className="text-sm text-[var(--t2)] mt-1">
                      {suggestion.description}
                    </p>
                    <p className="text-xs text-[var(--t3)] mt-2">
                      {new Date(suggestion.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <MaterialIcon
                    icon={
                      suggestion.category === "bug"
                        ? "bug_report"
                        : suggestion.category === "feature"
                          ? "lightbulb"
                          : "chat"
                    }
                    className="text-2xl text-[var(--t3)]"
                  />
                </div>
              </CardBody>
            </Card>
          ))}

        {suggestions.length === 0 && (
          <Card className="p-8 text-center">
            <MaterialIcon
              icon="inbox"
              className="text-4xl text-[var(--t3)] mx-auto mb-2"
            />
            <p className="text-[var(--t2)]">No suggestions yet</p>
            <p className="text-sm text-[var(--t3)]">
              Be the first to share your thoughts!
            </p>
          </Card>
        )}
      </div>

      {/* Submit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Add Suggestion</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, category: cat.id as any })
                      }
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        form.category === cat.id
                          ? "border-[var(--primary)] bg-[var(--primary-soft)]"
                          : "border-[var(--border)] hover:border-[var(--primary)]/50"
                      }`}
                    >
                      <MaterialIcon icon={cat.icon} className="text-xl mb-1" />
                      <div className="text-sm font-medium">{cat.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                  placeholder="Brief summary"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Details
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="input min-h-[100px]"
                  placeholder="Tell us more..."
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" loading={submitting}>
                  Submit
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
