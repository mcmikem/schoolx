#!/usr/bin/env python3
"""Add PageErrorBoundary wrapping to Next.js page files."""

import re
import sys

FILES = [
    "src/app/dashboard/academic-terms/page.tsx",
    "src/app/dashboard/allocations/page.tsx",
    "src/app/dashboard/analytics/dna/page.tsx",
    "src/app/dashboard/analytics/page.tsx",
    "src/app/dashboard/assets/page.tsx",
    "src/app/dashboard/attendance/today/page.tsx",
    "src/app/dashboard/audit/page.tsx",
    "src/app/dashboard/auto-sms/page.tsx",
    "src/app/dashboard/automation/page.tsx",
    "src/app/dashboard/batch-reports/page.tsx",
    "src/app/dashboard/behavior/page.tsx",
    "src/app/dashboard/board-report/page.tsx",
    "src/app/dashboard/budget/page.tsx",
    "src/app/dashboard/bulk-sms/page.tsx",
    "src/app/dashboard/calendar/page.tsx",
    "src/app/dashboard/canteen/page.tsx",
    "src/app/dashboard/cashbook/page.tsx",
    "src/app/dashboard/class-comparison/page.tsx",
    "src/app/dashboard/comments/page.tsx",
    "src/app/dashboard/courses/page.tsx",
    "src/app/dashboard/custom-reports/page.tsx",
    "src/app/dashboard/discipline/page.tsx",
    "src/app/dashboard/dorm-attendance/page.tsx",
    "src/app/dashboard/dorm-supplies/page.tsx",
    "src/app/dashboard/dorm/page.tsx",
    "src/app/dashboard/dropout-tracking/page.tsx",
    "src/app/dashboard/exam-timetable/page.tsx",
    "src/app/dashboard/exams/page.tsx",
    "src/app/dashboard/expense-approvals/page.tsx",
    "src/app/dashboard/export/page.tsx",
    "src/app/dashboard/fee-terms/page.tsx",
    "src/app/dashboard/feedback/page.tsx",
    "src/app/dashboard/fees-lookup/page.tsx",
    "src/app/dashboard/fees/lookup/page.tsx",
    "src/app/dashboard/health-log/page.tsx",
    "src/app/dashboard/health/page.tsx",
    "src/app/dashboard/homework-submissions/page.tsx",
    "src/app/dashboard/homework/page.tsx",
    "src/app/dashboard/idcards/page.tsx",
    "src/app/dashboard/import/page.tsx",
    "src/app/dashboard/inventory/page.tsx",
    "src/app/dashboard/invoicing/page.tsx",
    "src/app/dashboard/leave-approvals/page.tsx",
    "src/app/dashboard/leave/page.tsx",
    "src/app/dashboard/lesson-plans/page.tsx",
    "src/app/dashboard/library/page.tsx",
    "src/app/dashboard/marks-completion/page.tsx",
    "src/app/dashboard/moes-reports/page.tsx",
    "src/app/dashboard/moes/page.tsx",
    "src/app/dashboard/notices/page.tsx",
    "src/app/dashboard/osx/page.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/parent/page.tsx",
    "src/app/dashboard/payment-plans/page.tsx",
    "src/app/dashboard/payroll/page.tsx",
    "src/app/dashboard/period-attendance/page.tsx",
    "src/app/dashboard/promotion/page.tsx",
    "src/app/dashboard/report-cards/page.tsx",
    "src/app/dashboard/rollover/page.tsx",
    "src/app/dashboard/scheme-of-work/page.tsx",
    "src/app/dashboard/schools/page.tsx",
    "src/app/dashboard/setup-wizard/page.tsx",
    "src/app/dashboard/setup/page.tsx",
    "src/app/dashboard/sms-templates/page.tsx",
    "src/app/dashboard/staff-activity/page.tsx",
    "src/app/dashboard/staff-attendance/page.tsx",
    "src/app/dashboard/staff-reviews/page.tsx",
    "src/app/dashboard/store/inventory/page.tsx",
    "src/app/dashboard/store/pos/page.tsx",
    "src/app/dashboard/store/wallets/page.tsx",
    "src/app/dashboard/student-enrollments/page.tsx",
    "src/app/dashboard/student-lookup/page.tsx",
    "src/app/dashboard/student-transfers/page.tsx",
    "src/app/dashboard/students/[id]/page.tsx",
    "src/app/dashboard/students/add/page.tsx",
    "src/app/dashboard/students/admission-package/page.tsx",
    "src/app/dashboard/students/conduct/page.tsx",
    "src/app/dashboard/students/id-cards/page.tsx",
    "src/app/dashboard/substitutions/page.tsx",
    "src/app/dashboard/suggestions/page.tsx",
    "src/app/dashboard/syllabus/page.tsx",
    "src/app/dashboard/sync-center/page.tsx",
    "src/app/dashboard/teacher-performance/page.tsx",
    "src/app/dashboard/term-end/page.tsx",
    "src/app/dashboard/timetable/page.tsx",
    "src/app/dashboard/transport/page.tsx",
    "src/app/dashboard/trends/page.tsx",
    "src/app/dashboard/uneb-registration/page.tsx",
    "src/app/dashboard/uneb/page.tsx",
    "src/app/dashboard/users/page.tsx",
    "src/app/dashboard/visitors/page.tsx",
    "src/app/dashboard/warnings/page.tsx",
    "src/app/dashboard/workflows/page.tsx",
    "src/app/dashboard/workload/page.tsx",
    "src/app/parent-portal/academics/page.tsx",
    "src/app/parent-portal/attendance/page.tsx",
    "src/app/parent-portal/fees/page.tsx",
    "src/app/parent-portal/messages/page.tsx",
    "src/app/parent-portal/notices/page.tsx",
    "src/app/parent-portal/page.tsx",
    "src/app/parent/dashboard/page.tsx",
    "src/app/parent/login/page.tsx",
    "src/app/parent/page.tsx",
    "src/app/setup-admin/page.tsx",
    "src/app/super-admin/page.tsx",
]

IMPORT_LINE = 'import { PageErrorBoundary } from "@/components/PageErrorBoundary";'

def process_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
    except FileNotFoundError:
        print(f"  SKIP (not found): {filepath}")
        return False

    if "PageErrorBoundary" in content:
        print(f"  SKIP (already has PageErrorBoundary): {filepath}")
        return False

    lines = content.splitlines(keepends=True)

    # --- Step 1: Add import ---
    # Find insertion point for import
    import_insert_idx = None

    # Check if first line is "use client"
    if lines and lines[0].strip() in ('"use client";', "'use client';"):
        # Insert import after "use client" line (and any blank lines after it)
        idx = 1
        while idx < len(lines) and lines[idx].strip() == "":
            idx += 1
        import_insert_idx = idx
    else:
        # Insert before first import line
        for i, line in enumerate(lines):
            if line.strip().startswith("import "):
                import_insert_idx = i
                break
        if import_insert_idx is None:
            # No imports found, insert at top
            import_insert_idx = 0

    lines.insert(import_insert_idx, IMPORT_LINE + "\n")

    # --- Step 2: Find the export default function's return statement ---
    # After inserting the import, recalculate
    # Find "export default function" line
    export_default_line = None
    for i, line in enumerate(lines):
        if re.match(r'\s*export\s+default\s+function\b', line):
            export_default_line = i
            break

    if export_default_line is None:
        # Try "export default" as arrow function or re-export
        # Some files may use: export default function ComponentName(
        # Or: const X = () => ...; export default X;
        # For simplicity, try to find the last export default
        for i, line in enumerate(lines):
            if 'export default' in line:
                export_default_line = i
        if export_default_line is None:
            print(f"  WARN (no export default function): {filepath}")
            # Write anyway with just the import
            with open(filepath, "w", encoding="utf-8") as f:
                f.writelines(lines)
            return True

    # Find the opening brace of the export default function body
    # We need to track brace depth to find the function body
    # Find "return (" within the export default function
    # Strategy: find "return (" after export_default_line, but be careful of nested functions

    # Track brace depth starting from the export default function line
    # to identify when we're inside the top-level function body (depth == 1)
    # and find the return statement at depth == 1

    brace_depth = 0
    func_body_start = None  # line index where function body begins
    return_line_idx = None

    # We'll scan from the export default line
    # First find the opening brace that starts the function body
    i = export_default_line
    while i < len(lines):
        line = lines[i]
        # Count braces (ignoring strings/comments for simplicity)
        for ch in line:
            if ch == '{':
                brace_depth += 1
                if brace_depth == 1 and func_body_start is None:
                    func_body_start = i
            elif ch == '}':
                brace_depth -= 1
        i += 1
        if func_body_start is not None:
            break

    if func_body_start is None:
        print(f"  WARN (could not find function body): {filepath}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True

    # Now scan from func_body_start to find "return (" at brace_depth == 1
    # brace_depth is currently 1 (we just opened the function body)
    # Continue scanning

    # Reset and rescan more carefully
    brace_depth = 0
    in_func = False
    return_line_idx = None

    i = export_default_line
    # First pass: find opening brace of function
    while i < len(lines):
        line = lines[i]
        for ch in line:
            if ch == '{':
                brace_depth += 1
                if brace_depth == 1:
                    in_func = True
            elif ch == '}':
                brace_depth -= 1
        if in_func:
            break
        i += 1

    i += 1  # move past the opening brace line

    # Now find return ( at brace_depth == 1 (inside the function, not nested)
    # brace_depth is now tracking relative to the function start
    # After the opening brace, depth is 1
    inner_depth = 1  # we're inside the function body

    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Check for return ( at the right depth
        if inner_depth == 1 and re.match(r'return\s*\(', stripped):
            return_line_idx = i
            break

        # Update depth
        for ch in line:
            if ch == '{':
                inner_depth += 1
            elif ch == '}':
                inner_depth -= 1
                if inner_depth == 0:
                    break  # exited the function

        if inner_depth == 0:
            break
        i += 1

    if return_line_idx is None:
        # Try return without parens or return on same line as JSX
        # Fallback: look for "return (" anywhere after export_default_line
        for i2 in range(export_default_line, len(lines)):
            if re.match(r'\s*return\s*\(', lines[i2]):
                return_line_idx = i2
                break

    if return_line_idx is None:
        print(f"  WARN (no return() found): {filepath}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True

    # --- Step 3: Find first JSX element after return ( ---
    # Look for first line starting with whitespace + "<" (JSX)
    # Skip blank lines and the "return (" line itself
    jsx_start_idx = None
    for i2 in range(return_line_idx + 1, len(lines)):
        stripped = lines[i2].strip()
        if stripped.startswith("<") and not stripped.startswith("</"):
            jsx_start_idx = i2
            break
        elif stripped == "":
            continue
        else:
            # Non-empty, non-JSX line after return ( — might be a fragment or expression
            # Check if it's a fragment <>
            if stripped.startswith("<>") or stripped.startswith("<React.Fragment"):
                jsx_start_idx = i2
                break
            break

    if jsx_start_idx is None:
        print(f"  WARN (no JSX start found after return): {filepath}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True

    # --- Step 4: Find the closing ); of the return ---
    # Find the last );  that closes this return statement
    # Strategy: find the closing "  );" by matching the paren depth
    # Count opening paren on return line
    return_line_content = lines[return_line_idx]
    paren_depth = return_line_content.count('(') - return_line_content.count(')')

    closing_paren_idx = None
    for i2 in range(return_line_idx + 1, len(lines)):
        line = lines[i2]
        # Count parens (rough, ignoring strings)
        paren_depth += line.count('(') - line.count(')')
        if paren_depth <= 0:
            closing_paren_idx = i2
            break

    if closing_paren_idx is None:
        # Fallback: look for "  );" pattern
        for i2 in range(return_line_idx + 1, len(lines)):
            stripped = lines[i2].strip()
            if stripped in (');', ')'):
                closing_paren_idx = i2
                break

    if closing_paren_idx is None:
        print(f"  WARN (no closing ); found): {filepath}")
        with open(filepath, "w", encoding="utf-8") as f:
            f.writelines(lines)
        return True

    # Determine indentation from the first JSX line
    first_jsx_line = lines[jsx_start_idx]
    indent = len(first_jsx_line) - len(first_jsx_line.lstrip())
    indent_str = " " * indent

    # Insert </PageErrorBoundary> before closing );
    # Insert <PageErrorBoundary> before first JSX element
    # Do closing first (higher index) to avoid shifting indices

    # Get the indentation of the closing );
    closing_line = lines[closing_paren_idx]
    closing_indent = len(closing_line) - len(closing_line.lstrip())
    closing_indent_str = " " * closing_indent

    lines.insert(closing_paren_idx, indent_str + "</PageErrorBoundary>\n")
    lines.insert(jsx_start_idx, indent_str + "<PageErrorBoundary>\n")

    with open(filepath, "w", encoding="utf-8") as f:
        f.writelines(lines)

    print(f"  OK: {filepath}")
    return True


if __name__ == "__main__":
    import os
    base = "/home/runner/work/schoolx/schoolx"
    ok = 0
    skipped = 0
    warned = 0
    for rel_path in FILES:
        full_path = os.path.join(base, rel_path)
        result = process_file(full_path)
        if result:
            ok += 1
        else:
            skipped += 1

    print(f"\nDone. Processed: {ok}, Skipped: {skipped}")
