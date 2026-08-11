"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { mapParentStudentLinks, resolveSelectedChild, ParentPortalChild } from "@/lib/parent-portal";
import { getDemoChildren } from "@/lib/parent-portal-demo";
import { withTimeout, timeoutFallback } from "@/lib/hooks/utils";
import { normalizeAuthPhone } from "@/lib/validation";
import { logger } from "@/lib/logger";

interface ParentPortalContextValue {
  children: ParentPortalChild[];
  selectedChild: ParentPortalChild | null;
  setSelectedChild: (child: ParentPortalChild) => void;
  refreshChildren: () => Promise<void>;
  loading: boolean;
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function useParentPortal() {
  const context = useContext(ParentPortalContext);
  if (!context) {
    throw new Error("useParentPortal must be used within ParentPortalProvider");
  }
  return context;
}

export function ParentPortalProvider({ children }: { children: React.ReactNode }) {
  const { user, isDemo } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get("child");

  const [list, setList] = useState<ParentPortalChild[]>([]);
  const [selectedChild, setSelectedChildState] = useState<ParentPortalChild | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const refreshChildren = useCallback(async () => {
    if (isDemo) {
      setList(getDemoChildren());
      setLoading(false);
      return;
    }
    const parentId = user?.id;
    if (!parentId) {
      setLoading(false);
      return;
    }
    const { data } = await withTimeout(
      supabase
        .from("parent_students")
        .select("student:students(id, first_name, last_name, school_id, class_id, class:classes(name))")
        .eq("parent_id", parentId),
      12000,
      timeoutFallback(),
    );
    let list = mapParentStudentLinks((data as any) || []);

    if (list.length === 0 && user.phone) {
      const normalized = normalizeAuthPhone(user.phone);
      if (normalized) {
        const last9 = normalized.slice(-9);

        const { data: matchedStudents } = await withTimeout(
          supabase
            .from("students")
            .select("id, parent_phone, parent_phone2, school_id")
            .eq("status", "active")
            .eq("school_id", user.school_id || "")
            .or(`parent_phone.eq.${normalized},parent_phone2.eq.${normalized}`),
          12000,
          timeoutFallback(),
        );

        let fuzzyMatches = matchedStudents;
        if (!fuzzyMatches?.length && last9 && user.school_id) {
          // Match the trailing 9 digits server-side; never download the whole
          // school's student table just to do a client-side filter on 3G.
          const { data: tailMatches } = await withTimeout(
            supabase
              .from("students")
              .select("id, parent_phone, parent_phone2, school_id")
              .eq("status", "active")
              .eq("school_id", user.school_id)
              .or(`parent_phone.like.%${last9},parent_phone2.like.%${last9}`)
              .limit(20),
            12000,
            timeoutFallback(),
          );
          fuzzyMatches =
            tailMatches?.filter((s) => s.parent_phone?.slice(-9) === last9 || s.parent_phone2?.slice(-9) === last9) ||
            null;
        }

        if (fuzzyMatches && fuzzyMatches.length > 0) {
          const links = fuzzyMatches.map((s: { id: string }) => ({
            parent_id: parentId,
            student_id: s.id,
            relationship: "parent",
          }));
          const { data: linkData, error: linkErr } = await withTimeout(
            supabase
              .from("parent_students")
              .insert(links)
              .select("student:students(id, first_name, last_name, school_id, class_id, class:classes(name))"),
            12000,
            timeoutFallback(),
          );

          if (!linkErr && linkData) {
            list = mapParentStudentLinks(linkData as any);
          } else if (linkErr) {
            logger.warn("[parent-portal] auto-link insert failed:", linkErr);
          }
        }
      }
    }

    setList(list);
    setLoading(false);
  }, [user?.id, user?.phone, user?.school_id, isDemo]);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;
    refreshChildren();
  }, [refreshChildren]);

  useEffect(() => {
    setSelectedChildState((current) => resolveSelectedChild(list, current?.id ?? requestedId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, requestedId]);

  const setSelectedChild = useCallback(
    (child: ParentPortalChild) => {
      setSelectedChildState(child);
      const params = new URLSearchParams(searchParams.toString());
      if (params.get("child") !== child.id) {
        params.set("child", child.id);
        router.replace(`${pathname}?${params.toString()}`);
      }
    },
    [router, pathname, searchParams],
  );

  const value = useMemo(
    () => ({
      children: list,
      selectedChild,
      setSelectedChild,
      refreshChildren,
      loading,
    }),
    [list, selectedChild, setSelectedChild, refreshChildren, loading],
  );

  return <ParentPortalContext.Provider value={value}>{children}</ParentPortalContext.Provider>;
}
