# Offline and speed upgrade

## First implementation pass

- Reconnecting no longer downloads every major school table. The focused page refreshes its own data, and queued local changes sync in the background.
- Pending changes are no longer retried every ten seconds. The app checks the queue every thirty seconds and attempts sync when the dashboard opens or the device reconnects.
- IndexedDB now uses an available index for common string and number filters before reading cached rows. This avoids loading a whole local table into an older phone's memory for school, date, class or student lookups.

## Existing offline workflows

Attendance, marks, fee payments, and canteen sales already have local queue paths. IndexedDB must have those records cached or entered on the device before a connection is lost. Queue replay and payment conflict behavior still need isolated database verification; an offline receipt should not be described as settled until sync succeeds.

## Remaining slow-load cause

The authenticated sign-in path still starts a background refresh of twelve whole tables. The auth context is explicitly marked as a locked critical file and needs approval before changing that call. The current pass does not remove that sign-in traffic or redesign profile verification.

## Offline limits

Not every create, edit, report, message, import, or setup operation is queued offline. Some pages still need the server, and cold first-time use without previously cached records cannot show school data offline. Full offline sign-in, cross-school cache isolation, sync conflict recovery, and low-end Android field performance need dedicated verification.

## Validation

Biome formatted the two changed TypeScript files, and `git diff --check` passed. No test suite or live database write was run for this pass.
