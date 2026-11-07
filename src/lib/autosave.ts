// Unified auto-save barrel.
//
// Two historical hooks lived in separate places:
//  - useFormDraft / AutoSaveIndicator  (src/lib/useAutoSave.tsx)
//  - useAutoSave (periodic sync)        (src/lib/hooks/useAutoSave.ts)
//
// They serve different purposes (form drafts vs periodic data sync) so both
// APIs are preserved. This barrel is the single import site going forward.
export { useFormDraft, useFormState, AutoSaveIndicator } from "./useAutoSave";
export { useAutoSave, useFieldValidation } from "./hooks/useAutoSave";
