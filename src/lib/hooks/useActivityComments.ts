import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";

interface ActivityComment {
  id: string;
  entity_type: string;
  entity_id: string;
  author_id: string;
  author_name: string;
  content: string;
  comment_type: "note" | "system" | "action_required" | "resolved";
  is_internal: boolean;
  parent_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  replies?: ActivityComment[];
}

interface UseActivityCommentsOptions {
  entityType?: string;
  entityId?: string;
}

export function useActivityComments(options: UseActivityCommentsOptions = {}) {
  const { user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState<ActivityComment[]>([]);

  const fetchComments = useCallback(async () => {
    if (!options.entityType || !options.entityId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("activity_comments")
        .select("*")
        .eq("entity_type", options.entityType)
        .eq("entity_id", options.entityId)
        .is("parent_id", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (err) {
      console.error("Error fetching comments:", err);
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  }, [options.entityType, options.entityId, toast]);

  const addComment = useCallback(
    async (
      content: string,
      commentType: ActivityComment["comment_type"] = "note",
      isInternal = false,
      parentId?: string,
    ) => {
      if (!options.entityType || !options.entityId) return null;

      try {
        const { data, error } = await supabase
          .from("activity_comments")
          .insert({
            entity_type: options.entityType,
            entity_id: options.entityId,
            content,
            comment_type: commentType,
            is_internal: isInternal,
            parent_id: parentId || null,
          })
          .select()
          .single();

        if (error) throw error;
        toast.success("Comment added");
        fetchComments();
        return data;
      } catch (err) {
        console.error("Error adding comment:", err);
        toast.error("Failed to add comment");
        return null;
      }
    },
    [options.entityType, options.entityId, toast, fetchComments],
  );

  const updateComment = useCallback(
    async (id: string, content: string) => {
      try {
        const { error } = await supabase
          .from("activity_comments")
          .update({ content })
          .eq("id", id);

        if (error) throw error;
        toast.success("Comment updated");
        fetchComments();
      } catch (err) {
        console.error("Error updating comment:", err);
        toast.error("Failed to update comment");
      }
    },
    [toast, fetchComments],
  );

  const deleteComment = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("activity_comments")
          .delete()
          .eq("id", id);

        if (error) throw error;
        toast.success("Comment deleted");
        fetchComments();
      } catch (err) {
        console.error("Error deleting comment:", err);
        toast.error("Failed to delete comment");
      }
    },
    [toast, fetchComments],
  );

  const resolveAction = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("activity_comments")
          .update({ comment_type: "resolved" })
          .eq("id", id);

        if (error) throw error;
        toast.success("Action resolved");
        fetchComments();
      } catch (err) {
        console.error("Error resolving action:", err);
        toast.error("Failed to resolve action");
      }
    },
    [toast, fetchComments],
  );

  return {
    comments,
    loading,
    fetchComments,
    addComment,
    updateComment,
    deleteComment,
    resolveAction,
  };
}

export default useActivityComments;
