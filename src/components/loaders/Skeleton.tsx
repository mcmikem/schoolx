"use client";
// Compatibility shim — canonical implementation is in @/components/ui/Skeleton
// This file re-exports unified wave skeletons so both import paths work.
// (Local Stats/Form/Page/Sidebar variants were removed: zero importers.
// Use ui/Skeleton's StatSkeleton, PageLoader, DashboardSkeleton instead.)
export { Skeleton, CardSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
