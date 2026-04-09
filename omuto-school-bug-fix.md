# Omuto School Management System - Bug Fix Plan

## Project Type

WEB (Next.js/React application)

## Task Description

Fix the left menu not disappearing after clicking an item on mobile/tablet views. This is a state synchronization issue between the SidebarContext React state and direct DOM manipulation.

## Affected Files

- src/components/dashboard/TopBar.tsx - Mobile menu button uses direct DOM manipulation instead of SidebarContext

## Root Cause

The mobile menu button in TopBar.tsx uses `document.querySelector` to toggle sidebar classes directly, bypassing the React state management in SidebarContext. This creates a state mismatch where:

- Clicking menu items closes sidebar via SidebarContext (state: false)
- But DOM still has sidebar.open class and sidebar-overlay.visible
- Result: Sidebar appears stuck open

## Solution Plan

1. Import useSidebar hook in TopBar.tsx
2. Replace direct DOM manipulation with proper context state calls
3. Test on mobile/tablet breakpoints to ensure sidebar hides after menu item clicks

## Verification Steps

1. Run lint to ensure no regressions
2. Verify build passes
3. Test mobile menu behavior manually
4. Confirm no accessibility regressions
